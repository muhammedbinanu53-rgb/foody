const sharp = require("sharp");

async function createIcons() {
  await sharp("public/foody-icon.svg")
    .resize(192, 192)
    .png()
    .toFile("public/foody-icon-192.png");

  await sharp("public/foody-icon.svg")
    .resize(512, 512)
    .png()
    .toFile("public/foody-icon-512.png");

  console.log("Foody icons created successfully!");
}

createIcons().catch((error) => {
  console.error(error);
  process.exit(1);
});
