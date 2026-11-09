#!/bin/sh
set -eu

here=$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)
config_dir="$HOME/.config"
service_dir="$config_dir/systemd/user"
env_file="$config_dir/muusia-print.env"

mkdir -p "$service_dir"
install -m 644 "$here/muusia-print.service" "$service_dir/muusia-print.service"

if [ ! -e "$env_file" ]; then
    umask 077
    python3 -c 'import secrets; print("MUUSIA_PRINT_TOKEN=" + secrets.token_urlsafe(32))' > "$env_file"
    printf 'MUUSIA_PRINT_OUTPUT_FILE=%s/test-output.escpos\n' "$here" >> "$env_file"
fi
chmod 600 "$env_file"

systemctl --user daemon-reload
systemctl --user enable --now muusia-print.service
systemctl --user --no-pager status muusia-print.service

printf '\nPi service listens on 127.0.0.1:8631. Use a free Mac port for the SSH tunnel.\n'
printf 'The token is in %s on the Pi.\n' "$env_file"
if ! loginctl show-user "$(id -un)" -p Linger 2>/dev/null | grep -q 'Linger=yes'; then
    printf 'For startup after reboot, run: loginctl enable-linger %s\n' "$(id -un)"
fi
