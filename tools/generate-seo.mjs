import { mkdirSync, rmSync, writeFileSync } from "node:fs";

const SITE_URL = (process.env.SITE_URL || "https://amosceaf.github.io/WORKLY").replace(/\/$/, "");
const SB_URL = "https://uenskswvwdziqxvafgyu.supabase.co";
const SB_KEY = "sb_publishable_cF5MFw7jUNKDKV1LlRqkAQ_zTFMIRYt";

const ISO = {
  "Côte d’Ivoire":"CI","Sénégal":"SN","Mali":"ML","Burkina Faso":"BF","Bénin":"BJ","Togo":"TG",
  "Ghana":"GH","Nigeria":"NG","Guinée":"GN","Niger":"NE","Maroc":"MA","Algérie":"DZ","Tunisie":"TN",
  "Égypte":"EG","Cameroun":"CM","Gabon":"GA","Congo (Brazzaville)":"CG","RD Congo":"CD","Kenya":"KE",
  "Afrique du Sud":"ZA","Rwanda":"RW","Éthiopie":"ET","Tanzanie":"TZ","France":"FR","Belgique":"BE",
  "Suisse":"CH","Canada":"CA","États-Unis":"US","Royaume-Uni":"GB","Allemagne":"DE","Espagne":"ES"
};
const CONTRACT = {
  "CDI":"FULL_TIME","CDD":"TEMPORARY","Stage":"INTERN","Freelance":"CONTRACTOR",
  "Temps partiel":"PART_TIME","Autre":"OTHER"
};

const esc = (t) => String(t ?? "").replace(/[&<>"']/g, (c) =>
  ({ "&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;" }[c]));

const res = await fetch(
  `${SB_URL}/rest/v1/jobs?select=*&active=eq.true&order=created_at.desc&limit=1000`,
  { headers: { apikey: SB_KEY } }
);
if (!res.ok) {
  console.error("Lecture des offres impossible :", res.status, await res.text());
  process.exit(1);
}
const today = new Date().toISOString().slice(0, 10);
const jobs = (await res.json()).filter((j) => !j.deadline || j.deadline >= today);

rmSync("offres", { recursive: true, force: true });
mkdirSync("offres", { recursive: true });

const urls = [`<url><loc>${SITE_URL}/</loc></url>`];

for (const j of jobs) {
  const url = `${SITE_URL}/offres/${j.id}.html`;
  const desc = (j.description || "").trim() ||
    `${j.company} recrute : ${j.title} à ${j.city}, ${j.country}.`;
  const country = ISO[j.country] || j.country;

  const ld = {
    "@context": "https://schema.org",
    "@type": "JobPosting",
    title: j.title,
    description: desc.split(/\n+/).map((p) => `<p>${esc(p)}</p>`).join(""),
    datePosted: (j.created_at || today).slice(0, 10),
    employmentType: CONTRACT[j.contract] || "FULL_TIME",
    hiringOrganization: { "@type": "Organization", name: j.company, sameAs: SITE_URL },
    jobLocation: {
      "@type": "Place",
      address: {
        "@type": "PostalAddress",
        addressLocality: j.city && j.city !== "—" ? j.city : undefined,
        addressCountry: country
      }
    },
    directApply: false
  };
  if (j.deadline) ld.validThrough = `${j.deadline}T23:59:59`;
  if (j.remote) {
    ld.jobLocationType = "TELECOMMUTE";
    ld.applicantLocationRequirements = { "@type": "Country", name: j.country };
  }
  const ldJson = JSON.stringify(ld).replace(/</g, "\\u003c");

  const metaDesc = desc.replace(/\s+/g, " ").slice(0, 155);
  const tags = (j.tags || []).map((t) => `<li>${esc(t)}</li>`).join("");

  const html = `<!DOCTYPE html>
<html lang="fr"><head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>${esc(j.title)} – ${esc(j.company)} | Workly</title>
<meta name="description" content="${esc(metaDesc)}">
<link rel="canonical" href="${url}">
<meta property="og:title" content="${esc(j.title)} – ${esc(j.company)}">
<meta property="og:description" content="${esc(metaDesc)}">
<meta property="og:type" content="website">
<meta property="og:url" content="${url}">
<script type="application/ld+json">${ldJson}</script>
<style>
body{font:16px/1.6 system-ui,Arial,sans-serif;max-width:760px;margin:0 auto;padding:24px 16px;color:#162033}
.btn{display:inline-block;background:#4F46E5;color:#fff;padding:12px 20px;border-radius:10px;text-decoration:none;font-weight:700}
.meta{color:#5D6B82}
</style>
</head><body>
<p><a href="${SITE_URL}/">← Workly × Evolia</a></p>
<h1>${esc(j.title)}</h1>
<p class="meta">${esc(j.company)} · ${esc(j.city)}, ${esc(j.country)} · ${esc(j.contract || "CDI")}${j.remote ? " · Télétravail possible" : ""}</p>
${j.deadline ? `<p class="meta">Candidature avant le ${esc(j.deadline)}</p>` : ""}
<h2>Description du poste</h2>
${desc.split(/\n+/).map((p) => `<p>${esc(p)}</p>`).join("")}
${tags ? `<h2>Compétences</h2><ul>${tags}</ul>` : ""}
<p><a class="btn" href="${SITE_URL}/#offres">Voir l'offre et postuler sur Workly</a></p>
</body></html>`;

  writeFileSync(`offres/${j.id}.html`, html);
  urls.push(`<url><loc>${url}</loc><lastmod>${(j.created_at || today).slice(0, 10)}</lastmod></url>`);
}

writeFileSync(
  "sitemap.xml",
  `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls.join("\n")}\n</urlset>\n`
);
console.log(`${jobs.length} offre(s) générée(s).`);
