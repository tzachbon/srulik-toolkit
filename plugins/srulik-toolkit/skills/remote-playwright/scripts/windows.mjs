// PowerShell builders for the Windows browser host. Pure functions: each returns script text for an adapter.
// Every script prints exactly one JSON line prefixed with RP_JSON= so adapters may add their own output.

const ps = value => `'${String(value).replaceAll("'", "''")}'`;
const stageRoot = '$env:LOCALAPPDATA\\RemotePlaywright';

// Samples CPU, per-engine GPU utilisation and free memory. Only non-zero engine samples are returned, with the total
// sample count, so the output stays small. Engine grouping happens in gpuMax() on the VPS.
export function psProbe() {
  return `$ErrorActionPreference='Stop'
$c=Get-Counter '\\Processor(_Total)\\% Processor Time','\\GPU Engine(*)\\Utilization Percentage' -SampleInterval 1 -MaxSamples 2 -ErrorAction SilentlyContinue
$cpu=@(); $gpu=@(); $zero=0
foreach($set in $c){ foreach($s in $set.CounterSamples){
  if($s.Path -like '*\\processor(_total)\\*'){ $cpu+=$s.CookedValue } elseif($s.CookedValue -gt 0){ $gpu+=[pscustomobject]@{i=$s.InstanceName;v=[math]::Round($s.CookedValue,2);t=$set.Timestamp.Ticks} } else { $zero++ } } }
$free=[math]::Floor((Get-CimInstance Win32_OperatingSystem).FreePhysicalMemory/1024)
'RP_JSON='+(@{cpu=$cpu;gpu=@($gpu);gpuSamples=($gpu.Count+$zero);freeMB=$free}|ConvertTo-Json -Compress -Depth 4)`;
}

// Stages playwright-core, starts the proxy, adds the Serve route and records ownership. Rolls back on failure.
export function psStart({ version, port, args, tokenHash, proxySource }) {
  return `$ErrorActionPreference='Stop'
$stage=Join-Path ${stageRoot} ${ps(version)}; $run=Join-Path ${stageRoot} 'run'
$ts=Join-Path $env:ProgramFiles 'Tailscale\\tailscale.exe'; $port=${Number(port)}
$created=@{}
function Out($o){ 'RP_JSON='+($o|ConvertTo-Json -Compress) }
try {
  if(Test-Path (Join-Path $run 'owner.json')){
    $o=Get-Content (Join-Path $run 'owner.json') -Raw | ConvertFrom-Json
    $p=Get-CimInstance Win32_Process -Filter "ProcessId=$($o.pid)" -ErrorAction SilentlyContinue
    if($p -and [string]$p.CreationDate.ToUniversalTime().Ticks -eq [string]$o.created){ Out @{error='conflict';detail='a server from an earlier start is still running; run stop first'}; exit 0 }
    if($o.serveAdded -and ((& $ts serve status 2>&1 | Out-String) -match ":$($o.port)\\b")){ Out @{error='conflict';detail='an earlier start left its Serve route; run stop first'}; exit 0 }
    Remove-Item $run -Recurse -Force
  }
  if((& $ts serve status 2>&1 | Out-String) -match ":$port\\b"){ Out @{error='conflict';detail="Tailscale Serve already uses TCP $port"}; exit 0 }
  $core=Join-Path $stage 'node_modules\\playwright-core'
  if(-not (Test-Path (Join-Path $core 'package.json'))){
    New-Item -ItemType Directory -Force $stage | Out-Null
    & npm.cmd install --no-save --no-audit --no-fund --prefix $stage ('playwright-core@'+${ps(version)}) 2>&1 | Out-Null
    if($LASTEXITCODE -ne 0){ Out @{error='stage';detail='npm install playwright-core failed'}; exit 0 }
  }
  if((Get-Content (Join-Path $core 'package.json') -Raw | ConvertFrom-Json).version -ne ${ps(version)}){ Out @{error='stage';detail='staged playwright-core version differs'}; exit 0 }
  & node (Join-Path $core 'cli.js') install chromium 2>&1 | Out-Null
  if($LASTEXITCODE -ne 0){ Out @{error='stage';detail='Chromium install failed'}; exit 0 }
  New-Item -ItemType Directory -Force $run | Out-Null; $created.run=$true
  & icacls $run /inheritance:r /grant:r "$($env:USERNAME):(OI)(CI)F" | Out-Null
  [IO.File]::WriteAllText((Join-Path $run 'proxy.cjs'),[Text.Encoding]::UTF8.GetString([Convert]::FromBase64String(${ps(Buffer.from(proxySource).toString('base64'))})))
  [IO.File]::WriteAllText((Join-Path $run 'token.sha256'),${ps(tokenHash)})
  # Win32_Process.Create detaches the proxy from this shell, so the adapter's call returns; handles stay unshared.
  $cmd='"'+(Get-Command node).Source+'" "'+(Join-Path $run 'proxy.cjs')+'" "'+$stage+'" "'+$run+'" '+$port+' '+${ps(Buffer.from(JSON.stringify(args)).toString('base64'))}
  $hidden=New-CimInstance -ClassName Win32_ProcessStartup -ClientOnly -Property @{ShowWindow=[uint16]0}
  $r=Invoke-CimMethod -ClassName Win32_Process -MethodName Create -Arguments @{CommandLine=$cmd;CurrentDirectory=$run;ProcessStartupInformation=$hidden}
  if($r.ReturnValue -ne 0){ throw "proxy launch failed ($($r.ReturnValue))" }
  $created.pid=$r.ProcessId
  for($i=0;$i -lt 120 -and -not (Test-Path (Join-Path $run 'ready'));$i++){ if(-not (Get-Process -Id $r.ProcessId -EA 0)){break}; Start-Sleep -Milliseconds 500 }
  if(-not (Test-Path (Join-Path $run 'ready'))){ throw ('proxy did not become ready: '+((Get-Content (Join-Path $run 'proxy.err') -EA 0) -join ' ')) }
  $made=[string](Get-CimInstance Win32_Process -Filter "ProcessId=$($r.ProcessId)").CreationDate.ToUniversalTime().Ticks
  & $ts serve --bg --tcp=$port ('tcp://127.0.0.1:'+$port) 2>&1 | Out-Null
  if($LASTEXITCODE -ne 0){ throw 'tailscale serve failed' }
  $created.serve=$true
  @{pid=$r.ProcessId;created=$made;port=$port;version=${ps(version)};serveAdded=$true}|ConvertTo-Json -Compress|Set-Content (Join-Path $run 'owner.json')
  $ip=(& $ts ip -4 | Select-Object -First 1).Trim()
  Out @{ok=$true;ip=$ip;port=$port;version=${ps(version)}}
} catch {
  if($created.serve){ & $ts serve --tcp=$port off 2>&1 | Out-Null }
  if($created.pid){ & taskkill.exe /PID $created.pid /T /F 2>&1 | Out-Null }
  if($created.run){ Remove-Item $run -Recurse -Force -ErrorAction SilentlyContinue }
  Out @{error='start';detail="$_"}
}`;
}

// Removes only what owner.json records: the exact proxy process tree and the Serve route start added.
export function psStop({ port }) {
  return `$ErrorActionPreference='Stop'
$run=Join-Path ${stageRoot} 'run'; $ts=Join-Path $env:ProgramFiles 'Tailscale\\tailscale.exe'
$left=@(); $f=Join-Path $run 'owner.json'
if(Test-Path $f){
  $o=Get-Content $f -Raw | ConvertFrom-Json
  $p=Get-CimInstance Win32_Process -Filter "ProcessId=$($o.pid)" -ErrorAction SilentlyContinue
  if($p -and [string]$p.CreationDate.ToUniversalTime().Ticks -eq [string]$o.created){ & taskkill.exe /PID $o.pid /T /F 2>&1 | Out-Null }
  if($o.serveAdded){ & $ts serve --tcp=$($o.port) off 2>&1 | Out-Null }
  $port=$o.port
} else { $port=${Number(port)} }
Start-Sleep -Milliseconds 500
if(Get-NetTCPConnection -LocalPort $port -State Listen -ErrorAction SilentlyContinue){ $left+="port $port still listening" }
if((& $ts serve status 2>&1 | Out-String) -match ":$port\\b"){ $left+="Serve route on $port remains (not created by start, or removal failed)" }
# Keep owner.json until cleanup is verified, so a later stop can retry.
if($left.Count -eq 0){ Remove-Item $run -Recurse -Force -ErrorAction SilentlyContinue }
'RP_JSON='+(@{ok=($left.Count -eq 0);left=$left}|ConvertTo-Json -Compress)`;
}

export function parseResult(stdout) {
  const line = String(stdout).split(/\r?\n/).reverse().find(l => l.startsWith('RP_JSON='));
  if (!line) throw Error('adapter returned no RP_JSON result');
  return JSON.parse(line.slice('RP_JSON='.length));
}
