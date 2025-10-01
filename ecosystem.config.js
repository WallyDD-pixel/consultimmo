module.exports = {
  apps: [
    {
      name: "immo",
      cwd: "/var/www/immo/app", // Chemin du projet sur le VPS
      script: "npm",
      args: "start -- -p 3001 -H 127.0.0.1",
      env: {
        NODE_ENV: "production",
        // SMTP OVH (modifiez avec vos vraies valeurs sur le VPS)
        SMTP_HOST: "smtp.mail.ovh.net",
        SMTP_PORT: "465", // 465 = SSL, 587 = STARTTLS
        SMTP_USER: "contact@immoencheres.com",
        SMTP_PASS: "Escalop08&&", // remplacez par votre mot de passe (ne committez pas en clair)
        MAIL_FROM: "Immo‑enchères <contact@immoencheres.com>",
        MAIL_TO: "vous@mail.com,associe@mail.com",
        // Scraper (optionnel)
        MAX_PAGE: "50"
      }
    }
  ]
};
