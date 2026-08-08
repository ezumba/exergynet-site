// Read-only PM2 env inspection: extracts exactly one env var name from one
// named process and prints nothing else. Never dumps the full environment.
//
// Runs `pm2 jlist` itself via child_process rather than reading it from
// stdin: when this script's own source is streamed into `node -` (LNES-58.11C
// zero-write invocation), node consumes stdin fully to obtain the program
// text before execution starts, so by the time this script would attach a
// stdin listener the stream has already ended and never fires again --
// confirmed empirically (`cat script | node -` produces no output at all).
// Self-contained execSync avoids that entirely.
const { execSync } = require('child_process');

try {
  const raw = execSync('pm2 jlist', { encoding: 'utf8', maxBuffer: 20 * 1024 * 1024 });
  const list = JSON.parse(raw);
  const proc = list.find(p => p.name === 'exergynet-portal');
  if (!proc) {
    console.log('PROC_NOT_FOUND');
  } else {
    const env = (proc.pm2_env && proc.pm2_env.env) || {};
    const val = env.XLMP_DATA_DIR;
    console.log(val ? ('XLMP_DATA_DIR=' + val) : 'XLMP_DATA_DIR_UNSET_IN_PM2_ENV');
  }
} catch (e) {
  console.log('PM2_JLIST_ERROR');
}
