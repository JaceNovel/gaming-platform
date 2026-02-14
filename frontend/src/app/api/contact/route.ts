import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { name, email, subject, message } = body;

    // Basic validation
    if (!name || !email || !subject || !message) {
      return NextResponse.json(
        { error: "Tous les champs sont obligatoires" },
        { status: 400 }
      );
    }

    // Email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return NextResponse.json(
        { error: "Adresse email invalide" },
        { status: 400 }
      );
    }

    // Message length validation
    if (message.length < 10 || message.length > 5000) {
      return NextResponse.json(
        { error: "Le message doit faire entre 10 et 5000 caractères" },
        { status: 400 }
      );
    }

    // TODO: Send email via service (SendGrid, Nodemailer, etc.)
    // For now, just log and return success
    console.log("Contact form submission:", {
      name,
      email,
      subject,
      message,
      timestamp: new Date().toISOString(),
    });

    // You could integrate with a service like SendGrid, Nodemailer, or Resend here
    // Example with Resend (if configured):
    // await resend.emails.send({
    //   from: "noreply@primegaming.space",
    //   to: "support@primegaming.space",
    //   subject: `[Contact] ${subject}`,
    //   html: `
    //     <h2>Nouveau message de contact</h2>
    //     <p><strong>De :</strong> ${name} (${email})</p>
    //     <p><strong>Sujet :</strong> ${subject}</p>
    //     <p><strong>Message :</strong></p>
    //     <p>${message.replace(/\n/g, "<br>")}</p>
    //   `,
    //   replyTo: email,
    // });

    return NextResponse.json(
      {
        success: true,
        message: "Votre message a été reçu. Nous vous répondrons bientôt.",
      },
      { status: 200 }
    );
  } catch (error) {
    console.error("Contact form error:", error);
    return NextResponse.json(
      { error: "Une erreur est survenue lors du traitement de votre requête" },
      { status: 500 }
    );
  }
}
