import * as pty from 'node-pty';
import { execSync } from 'child_process';

function getLoginShellPath(): string {
  try {
    return execSync('/bin/bash -lc "echo $PATH"').toString().trim();
  } catch {
    return process.env.PATH ?? '';
  }
}

const LOGIN_PATH = getLoginShellPath();

// Truecolor: info-blue for cwd, accent-orange for git branch, dim for $ sign
const BASH_PROMPT_COMMAND =
  '_b=$(git branch --show-current 2>/dev/null);' +
  'if [ -n "$_b" ]; then' +
  ' PS1="\\[\\e[38;2;121;192;255m\\]\\w\\[\\e[0m\\] \\[\\e[38;2;212;132;90m\\]($_b)\\[\\e[0m\\] \\[\\e[38;2;110;118;129m\\]\\$\\[\\e[0m\\] ";' +
  'else' +
  ' PS1="\\[\\e[38;2;121;192;255m\\]\\w\\[\\e[0m\\] \\[\\e[38;2;110;118;129m\\]\\$\\[\\e[0m\\] ";' +
  'fi';

export function spawnSession(
  cwd: string,
  cols: number,
  rows: number,
  command: string = 'claude',
  args: string[] = [],
): pty.IPty {
  const isBash = command === 'bash';
  return pty.spawn(command, args, {
    name: 'xterm-256color',
    cols,
    rows,
    cwd,
    env: {
      ...process.env,
      PATH: LOGIN_PATH,
      TERM: 'xterm-256color',
      COLORTERM: 'truecolor',
      CLICOLOR: '1',
      LSCOLORS: 'ExFxBxDxCxegedabagacad',
      ...(isBash && {
        GREP_COLOR: '1;36',
        PROMPT_COMMAND: BASH_PROMPT_COMMAND,
        PS1: '\\[\\e[38;2;121;192;255m\\]\\w\\[\\e[0m\\] \\[\\e[38;2;110;118;129m\\]\\$\\[\\e[0m\\] ',
      }),
    },
  });
}

export function resizeSession(ptyProcess: pty.IPty, cols: number, rows: number): void {
  ptyProcess.resize(cols, rows);
}
