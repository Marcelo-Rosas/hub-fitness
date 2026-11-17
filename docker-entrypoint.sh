#!/bin/sh
set -e

# Certificado A1 PUCOMEX: secrets da Cloudflare têm limite de 5 KB, então o
# .pfx chega em base64 dividido em PUCOMEX_CERT_PFX_B64_1..3. Remonta em /tmp
# (fora da imagem) e aponta PUCOMEX_CERT_PFX_PATH para ele.
# tr remove espaço/tab/CR/LF colados nos chunks — senão o .pfx sai corrompido
# e o OpenSSL acusa "mac verify failure".
if [ -n "$PUCOMEX_CERT_PFX_B64_1" ]; then
  umask 077
  printf '%s%s%s' "$PUCOMEX_CERT_PFX_B64_1" "${PUCOMEX_CERT_PFX_B64_2:-}" "${PUCOMEX_CERT_PFX_B64_3:-}" \
    | tr -d ' \t\r\n' | base64 -d > /tmp/pucomex-cert.pfx
  export PUCOMEX_CERT_PFX_PATH=/tmp/pucomex-cert.pfx
fi
unset PUCOMEX_CERT_PFX_B64_1 PUCOMEX_CERT_PFX_B64_2 PUCOMEX_CERT_PFX_B64_3

# Segunda credencial: e-CPF do representante do importador (Role-Type IMPEXP,
# que só aceita e-CPF). Mesmo esquema: PUCOMEX_REP_CERT_PFX_B64_1..3.
if [ -n "$PUCOMEX_REP_CERT_PFX_B64_1" ]; then
  umask 077
  printf '%s%s%s' "$PUCOMEX_REP_CERT_PFX_B64_1" "${PUCOMEX_REP_CERT_PFX_B64_2:-}" "${PUCOMEX_REP_CERT_PFX_B64_3:-}" \
    | tr -d ' \t\r\n' | base64 -d > /tmp/pucomex-rep-cert.pfx
  export PUCOMEX_REP_CERT_PFX_PATH=/tmp/pucomex-rep-cert.pfx
fi
unset PUCOMEX_REP_CERT_PFX_B64_1 PUCOMEX_REP_CERT_PFX_B64_2 PUCOMEX_REP_CERT_PFX_B64_3

exec "$@"
