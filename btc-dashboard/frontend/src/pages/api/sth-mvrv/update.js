/**
 * /api/sth-mvrv/update
 *
 * Endpoint chamado pelo GitHub Actions para atualizar sth-mvrv.json
 * No Vercel free tier o filesystem é efêmero, então este endpoint
 * apenas confirma que está acessível. A atualização real acontece
 * via GitHub Actions rodando update-sth-mvrv.mjs localmente.
 */
export default function handler(req, res) {
  return res.status(200).json({
    ok: true,
    message: 'STH MVRV update is handled by GitHub Actions (update-sth-mvrv.mjs)',
    timestamp: new Date().toISOString(),
  });
}
