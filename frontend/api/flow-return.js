// Vercel Serverless Function
// Flow payment gateway redirects the user's browser to urlReturn via POST (Webpay behavior).
// Vercel's SPA rewrite only handles GET, so POST to /billing returns HTTP 405.
// This endpoint accepts the POST and redirects the browser to the SPA route via GET.
export default function handler(req, res) {
  res.writeHead(302, { Location: '/billing?billing=success' })
  res.end()
}
