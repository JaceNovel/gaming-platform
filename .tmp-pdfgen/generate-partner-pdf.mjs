import fs from "node:fs";
import path from "node:path";
import PDFDocument from "pdfkit";

const outputPath = path.resolve("/home/kernelx/gaming-platform/docs/partenariat-alibaba-prime-gaming.pdf");

const doc = new PDFDocument({
  size: "A4",
  margins: { top: 46, bottom: 46, left: 48, right: 48 },
  info: {
    Title: "Projet Partenariat Alibaba - PRIME Gaming",
    Author: "GitHub Copilot",
    Subject: "Proposition de partenariat Alibaba x PRIME Gaming",
  },
});

doc.pipe(fs.createWriteStream(outputPath));

const colors = {
  bg: "#091324",
  bgSoft: "#0d1a30",
  panel: "#10203b",
  gold: "#f0c86f",
  goldDeep: "#b8861f",
  cyan: "#76e5ff",
  mint: "#8af0c8",
  white: "#eef6ff",
  muted: "#b8c7dc",
  ink: "#15243d",
  border: "#294364",
  rose: "#ff8aa2",
};

const pageWidth = doc.page.width;
const pageHeight = doc.page.height;
const contentWidth = pageWidth - doc.page.margins.left - doc.page.margins.right;

function addPageBackground() {
  doc.save();
  doc.rect(0, 0, pageWidth, pageHeight).fill(colors.bg);
  doc.circle(pageWidth - 70, 95, 110).fillOpacity(0.08).fill(colors.gold);
  doc.circle(78, 130, 95).fillOpacity(0.06).fill(colors.cyan);
  doc.circle(pageWidth / 2, pageHeight - 70, 130).fillOpacity(0.05).fill(colors.mint);
  doc.restore();
  doc.fillColor(colors.white);
}

function drawHeaderChip(text, x, y, width = 148) {
  doc.save();
  doc.roundedRect(x, y, width, 24, 12).fillAndStroke(colors.panel, colors.border);
  doc.fillColor(colors.cyan).font("Helvetica-Bold").fontSize(9).text(text.toUpperCase(), x, y + 8, {
    width,
    align: "center",
  });
  doc.restore();
}

function drawSectionTitle(eyebrow, title, subtitle, y) {
  drawHeaderChip(eyebrow, doc.page.margins.left, y, 156);
  doc.fillColor(colors.white).font("Helvetica-Bold").fontSize(22).text(title, doc.page.margins.left, y + 34, {
    width: contentWidth,
  });
  if (subtitle) {
    doc.fillColor(colors.muted).font("Helvetica").fontSize(11.5).text(subtitle, doc.page.margins.left, y + 66, {
      width: contentWidth,
      lineGap: 4,
    });
  }
}

function drawMetricCard(x, y, width, value, label, accent) {
  doc.save();
  doc.roundedRect(x, y, width, 86, 18).fillAndStroke(colors.panel, colors.border);
  doc.fillColor(accent).font("Helvetica-Bold").fontSize(22).text(value, x + 16, y + 16);
  doc.fillColor(colors.muted).font("Helvetica").fontSize(10.5).text(label, x + 16, y + 46, {
    width: width - 32,
    lineGap: 2,
  });
  doc.restore();
}

function drawBulletBlock({ x, y, width, title, bullets, accent = colors.gold, minHeight = 150 }) {
  doc.save();
  doc.roundedRect(x, y, width, minHeight, 20).fillAndStroke(colors.panel, colors.border);
  doc.fillColor(accent).font("Helvetica-Bold").fontSize(15).text(title, x + 18, y + 16, { width: width - 36 });
  let cursorY = y + 48;
  bullets.forEach((bullet) => {
    doc.fillColor(accent).font("Helvetica-Bold").fontSize(12).text("•", x + 18, cursorY);
    doc.fillColor(colors.muted).font("Helvetica").fontSize(11).text(bullet, x + 32, cursorY - 1, {
      width: width - 50,
      lineGap: 3,
    });
    cursorY = doc.y + 7;
  });
  doc.restore();
}

function drawNumberedStep(x, y, width, number, text) {
  doc.save();
  doc.roundedRect(x, y, width, 112, 20).fillAndStroke(colors.panel, colors.border);
  doc.roundedRect(x + 16, y + 14, 34, 24, 12).fillAndStroke("#12335e", "#2766a3");
  doc.fillColor(colors.cyan).font("Helvetica-Bold").fontSize(11).text(number, x + 16, y + 20, {
    width: 34,
    align: "center",
  });
  doc.fillColor(colors.white).font("Helvetica-Bold").fontSize(12.5).text(text, x + 16, y + 52, {
    width: width - 32,
    lineGap: 3,
  });
  doc.restore();
}

function ensureSpace(requiredHeight) {
  if (doc.y + requiredHeight <= pageHeight - doc.page.margins.bottom) return;
  doc.addPage();
  addPageBackground();
  doc.y = doc.page.margins.top;
}

addPageBackground();

doc.fillColor(colors.white).font("Helvetica-Bold").fontSize(14).text("PRIME Gaming", doc.page.margins.left, 26);
doc.fillColor(colors.cyan).font("Helvetica-Bold").fontSize(9).text("PROPOSITION PARTENAIRE", doc.page.margins.left, 44);

doc.save();
doc.roundedRect(doc.page.margins.left, 78, contentWidth, 220, 28).fillAndStroke(colors.bgSoft, colors.border);
doc.restore();

drawHeaderChip("Strategie 2026", doc.page.margins.left + 24, 98, 126);

doc.fillColor(colors.white).font("Helvetica-Bold").fontSize(28).text(
  "Projet de partenariat Alibaba pour le developpement du sourcing accessoires de PRIME Gaming",
  doc.page.margins.left + 24,
  132,
  { width: contentWidth - 48, lineGap: 2 }
);

doc.fillColor(colors.muted).font("Helvetica").fontSize(12).text(
  "Nous proposons un partenariat structure dans lequel Alibaba devient la couche amont de sourcing et de groupage, tandis que PRIME Gaming conserve le catalogue public, la relation client, le paiement, la marque et la distribution locale finale.",
  doc.page.margins.left + 24,
  212,
  { width: contentWidth - 210, lineGap: 5 }
);

doc.save();
doc.roundedRect(pageWidth - 182, 112, 110, 132, 24).fillAndStroke("#112746", "#28507f");
doc.fillColor(colors.gold).font("Helvetica-Bold").fontSize(18).text("Alibaba", pageWidth - 168, 142, { width: 82, align: "center" });
doc.fillColor(colors.muted).font("Helvetica").fontSize(9.5).text("Sourcing\nMOQ\nFournisseurs", pageWidth - 160, 174, {
  width: 70,
  align: "center",
  lineGap: 5,
});
doc.restore();

drawMetricCard(doc.page.margins.left + 24, 320, (contentWidth - 60) / 3, "Catalogue local", "Le storefront reste PRIME Gaming pour proteger l'experience client.", colors.gold);
drawMetricCard(doc.page.margins.left + 36 + (contentWidth - 60) / 3, 320, (contentWidth - 60) / 3, "Groupage", "Les commandes locales alimentent des batches d'achat fournisseurs.", colors.cyan);
drawMetricCard(doc.page.margins.left + 48 + ((contentWidth - 60) / 3) * 2, 320, (contentWidth - 60) / 3, "Stock local", "Reception entrepot puis livraison finale via notre pipeline existant.", colors.mint);

doc.y = 438;
drawSectionTitle(
  "Vision",
  "Une collaboration plus serieuse qu'un simple import produit",
  "L'objectif n'est pas de faire du dropshipping direct. L'objectif est de construire une chaine retail gaming plus fiable, avec une meilleure selection produit, une meilleure coherence prix/image/SKU et une execution logistique plus mature.",
  doc.y
);

doc.y = 552;
drawBulletBlock({
  x: doc.page.margins.left,
  y: doc.y,
  width: (contentWidth - 18) / 2,
  title: "Ce que PRIME Gaming apporte",
  accent: colors.gold,
  minHeight: 180,
  bullets: [
    "Une plateforme e-commerce gaming deja structuree avec catalogue, panier, paiement et fiches produit.",
    "Une demande locale agregee a partir des commandes clients et des besoins de restock.",
    "Une execution locale de marque, avec relation client et livraison finale mieux maitrisees.",
  ],
});

drawBulletBlock({
  x: doc.page.margins.left + (contentWidth - 18) / 2 + 18,
  y: doc.y,
  width: (contentWidth - 18) / 2,
  title: "Ce que nous attendons d'Alibaba",
  accent: colors.cyan,
  minHeight: 180,
  bullets: [
    "Un cadre de sourcing solide pour identifier des fournisseurs et des SKU pertinents.",
    "Une meilleure stabilite sur les conditions d'achat, la qualite et les flux amont.",
    "Une relation de structuration du canal accessoires, pas seulement une relation transactionnelle.",
  ],
});

doc.addPage();
addPageBackground();

drawSectionTitle(
  "Modele operationnel",
  "Le flux cible du partenariat",
  "Le client reste dans l'univers PRIME Gaming. Les informations fournisseurs restent cote sourcing. La chaine d'approvisionnement amont s'aligne sur la demande reelle et non sur des achats isoles sans lecture business.",
  48
);

const stepWidth = (contentWidth - 24) / 2;
drawNumberedStep(doc.page.margins.left, 164, stepWidth, "Etape 1", "Le client commande un accessoire dans le catalogue PRIME Gaming.");
drawNumberedStep(doc.page.margins.left + stepWidth + 24, 164, stepWidth, "Etape 2", "La commande payee alimente la demande d'approvisionnement et les besoins de restock.");
drawNumberedStep(doc.page.margins.left, 292, stepWidth, "Etape 3", "Les produits sources sont selectionnes et relies a des SKU fournisseurs valides sur Alibaba.");
drawNumberedStep(doc.page.margins.left + stepWidth + 24, 292, stepWidth, "Etape 4", "Les achats sont regroupes en batches afin d'ameliorer la rentabilite et la lisibilite logistique.");
drawNumberedStep(doc.page.margins.left, 420, contentWidth, "Etape 5", "Les produits sont recus en entrepot, le stock local est mis a jour, puis la livraison finale est assuree par notre pipeline existant.");

drawBulletBlock({
  x: doc.page.margins.left,
  y: 560,
  width: (contentWidth - 18) / 2,
  title: "Pourquoi ce modele est meilleur",
  accent: colors.mint,
  minHeight: 170,
  bullets: [
    "Il evite de melanger la promesse client avec des donnees fournisseurs brutes.",
    "Il protege la marque et rend l'experience d'achat plus premium.",
    "Il permet d'industrialiser le sourcing et les restocks sur des categories cibl ees.",
  ],
});

drawBulletBlock({
  x: doc.page.margins.left + (contentWidth - 18) / 2 + 18,
  y: 560,
  width: (contentWidth - 18) / 2,
  title: "Gains attendus",
  accent: colors.rose,
  minHeight: 170,
  bullets: [
    "Meilleure coherence entre image importee, SKU source et prix source reel.",
    "Meilleure disponibilite produit grace a une lecture plus fine de la demande.",
    "Base plus propre pour scaler les accessoires gaming sur plusieurs familles de produits.",
  ],
});

doc.addPage();
addPageBackground();

drawSectionTitle(
  "Valeur business",
  "Ce que chaque partie gagne dans le partenariat",
  "Le partenariat doit etre mutuellement utile. Alibaba renforce la puissance amont. PRIME Gaming transforme cette puissance en ventes, en confiance client et en execution locale coherente.",
  48
);

drawBulletBlock({
  x: doc.page.margins.left,
  y: 164,
  width: (contentWidth - 24) / 3,
  title: "Pour Alibaba",
  accent: colors.gold,
  minHeight: 202,
  bullets: [
    "Un cas d'usage concret dans l'e-commerce gaming africain.",
    "Un canal de debouche local avec demande reelle et agregee.",
    "Une preuve de valeur sur la structuration sourcing + distribution.",
  ],
});

drawBulletBlock({
  x: doc.page.margins.left + (contentWidth - 24) / 3 + 12,
  y: 164,
  width: (contentWidth - 24) / 3,
  title: "Pour PRIME Gaming",
  accent: colors.cyan,
  minHeight: 202,
  bullets: [
    "Acces a une selection plus stable de fournisseurs et de SKU.",
    "Reduction des erreurs de sourcing et meilleure qualite d'import.",
    "Levier de marge, de regularite et de diversification catalogue.",
  ],
});

drawBulletBlock({
  x: doc.page.margins.left + ((contentWidth - 24) / 3) * 2 + 24,
  y: 164,
  width: (contentWidth - 24) / 3,
  title: "Pour le client final",
  accent: colors.mint,
  minHeight: 202,
  bullets: [
    "Une experience plus rassurante que du dropshipping direct.",
    "Une meilleure qualite de selection et de disponibilite produit.",
    "Une promesse locale plus lisible sur les delais et le service.",
  ],
});

doc.save();
doc.roundedRect(doc.page.margins.left, 406, contentWidth, 122, 24).fillAndStroke(colors.bgSoft, colors.border);
doc.fillColor(colors.gold).font("Helvetica-Bold").fontSize(17).text("Positionnement", doc.page.margins.left + 20, 424);
doc.fillColor(colors.white).font("Helvetica-Bold").fontSize(15).text(
  "Nous ne cherchons pas uniquement un fournisseur. Nous cherchons un partenaire de structuration amont capable de soutenir une chaine retail gaming moderne.",
  doc.page.margins.left + 20,
  454,
  { width: contentWidth - 40, lineGap: 4 }
);
doc.restore();

drawMetricCard(doc.page.margins.left, 560, (contentWidth - 36) / 4, "25+", "References pilotes a fort potentiel sur la premiere vague.", colors.gold);
drawMetricCard(doc.page.margins.left + ((contentWidth - 36) / 4) + 12, 560, (contentWidth - 36) / 4, "72h", "Objectif de constitution d'un batch admin pret a etre soumis.", colors.cyan);
drawMetricCard(doc.page.margins.left + (((contentWidth - 36) / 4) + 12) * 2, 560, (contentWidth - 36) / 4, "98%", "Cible de coherence entre image source, SKU source et prix source.", colors.mint);
drawMetricCard(doc.page.margins.left + (((contentWidth - 36) / 4) + 12) * 3, 560, (contentWidth - 36) / 4, "90j", "Horizon pour un pilote structure avant passage a l'echelle.", colors.rose);

doc.addPage();
addPageBackground();

drawSectionTitle(
  "Roadmap",
  "Plan d'execution propose",
  "Le partenariat peut etre lance par un pilote simple, controle et mesurable, puis etendu sur de nouvelles categories d'accessoires et de nouveaux flux d'approvisionnement.",
  48
);

drawNumberedStep(doc.page.margins.left, 170, contentWidth, "Phase 1", "Cadrage: selection des categories cibles, definition du pilote et identification des fournisseurs prioritaires.");
drawNumberedStep(doc.page.margins.left, 300, contentWidth, "Phase 2", "Integration sourcing: import des produits source, mapping SKU, normalisation des fiches et alignement du catalogue local.");
drawNumberedStep(doc.page.margins.left, 430, contentWidth, "Phase 3", "Pilote logistique: groupage des achats, reception en entrepot, controle qualite et mise a jour du stock local.");
drawNumberedStep(doc.page.margins.left, 560, contentWidth, "Phase 4", "Scale commercial: augmentation des volumes, enrichissement du catalogue et stabilisation des cycles de restock.");

doc.save();
doc.roundedRect(doc.page.margins.left, 700, contentWidth, 84, 24).fillAndStroke(colors.panel, colors.border);
doc.fillColor(colors.white).font("Helvetica-Bold").fontSize(16).text("Prochaine etape souhaitee", doc.page.margins.left + 20, 718);
doc.fillColor(colors.muted).font("Helvetica").fontSize(11).text(
  "Organiser une reunion de cadrage partenariat pour valider le scope pilote, la logique fournisseur et les criteres de succes du projet.",
  doc.page.margins.left + 20,
  744,
  { width: contentWidth - 40, lineGap: 3 }
);
doc.restore();

doc.end();