"use client";

import { Metadata } from "next";
import { useState } from "react";
import { Mail, Phone, MapPin, Send } from "lucide-react";

export default function Contact() {
  const [loading, setLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    subject: "",
    message: "",
  });

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      // Simulate form submission (replace with actual API endpoint)
      const response = await fetch("/api/contact", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(formData),
      });

      if (!response.ok) {
        throw new Error("Erreur lors de l'envoi du message");
      }

      setSubmitted(true);
      setFormData({
        name: "",
        email: "",
        subject: "",
        message: "",
      });

      // Reset success message after 5 seconds
      setTimeout(() => {
        setSubmitted(false);
      }, 5000);
    } catch (err: any) {
      setError(err.message || "Une erreur est survenue. Veuillez réessayer.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-5xl mx-auto px-4 py-12 sm:px-6 lg:px-8">
      <h1 className="text-3xl sm:text-4xl font-bold mb-4 text-white">Nous Contacter</h1>
      <p className="text-slate-400 mb-12">Avez-vous des questions ou des suggestions ? Nous aimerions vous entendre !</p>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 mb-12">
        {/* Contact Info Cards */}
        <div className="bg-gradient-to-br from-slate-800 to-slate-900 p-6 rounded-lg border border-slate-700 hover:border-fuchsia-500/50 transition-colors duration-200">
          <Mail className="w-8 h-8 text-fuchsia-500 mb-4" />
          <h3 className="text-lg font-semibold text-white mb-2">Email</h3>
          <a
            href="mailto:support@primegaming.space"
            className="text-slate-400 hover:text-fuchsia-500 transition-colors duration-200 break-all"
          >
            support@primegaming.space
          </a>
        </div>

        <div className="bg-gradient-to-br from-slate-800 to-slate-900 p-6 rounded-lg border border-slate-700 hover:border-fuchsia-500/50 transition-colors duration-200">
          <Phone className="w-8 h-8 text-fuchsia-500 mb-4" />
          <h3 className="text-lg font-semibold text-white mb-2">Téléphone</h3>
          <p className="text-slate-400">Disponible via chat d'assistance</p>
        </div>

        <div className="bg-gradient-to-br from-slate-800 to-slate-900 p-6 rounded-lg border border-slate-700 hover:border-fuchsia-500/50 transition-colors duration-200">
          <MapPin className="w-8 h-8 text-fuchsia-500 mb-4" />
          <h3 className="text-lg font-semibold text-white mb-2">Localisation</h3>
          <p className="text-slate-400">Afrique de l'Ouest (Panafricain)</p>
        </div>
      </div>

      {/* Contact Form */}
      <div className="bg-gradient-to-br from-slate-800 to-slate-900 p-8 rounded-lg border border-slate-700">
        <h2 className="text-2xl font-semibold text-white mb-6">Envoyer un Message</h2>

        {submitted && (
          <div className="mb-6 p-4 bg-green-500/10 border border-green-500/30 rounded-lg text-green-400 flex items-center gap-3">
            <span>✓</span>
            <span>Message envoyé avec succès ! Nous vous répondrons bientôt.</span>
          </div>
        )}

        {error && (
          <div className="mb-6 p-4 bg-red-500/10 border border-red-500/30 rounded-lg text-red-400 flex items-center gap-3">
            <span>✕</span>
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
            {/* Name */}
            <div>
              <label className="block text-sm font-medium text-white mb-2">Nom *</label>
              <input
                type="text"
                name="name"
                value={formData.name}
                onChange={handleChange}
                required
                className="w-full px-4 py-2 bg-slate-700/50 border border-slate-600 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:border-fuchsia-500 focus:ring-1 focus:ring-fuchsia-500/50 transition-colors duration-200"
                placeholder="Votre nom"
              />
            </div>

            {/* Email */}
            <div>
              <label className="block text-sm font-medium text-white mb-2">Email *</label>
              <input
                type="email"
                name="email"
                value={formData.email}
                onChange={handleChange}
                required
                className="w-full px-4 py-2 bg-slate-700/50 border border-slate-600 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:border-fuchsia-500 focus:ring-1 focus:ring-fuchsia-500/50 transition-colors duration-200"
                placeholder="votre@email.com"
              />
            </div>
          </div>

          {/* Subject */}
          <div>
            <label className="block text-sm font-medium text-white mb-2">Sujet *</label>
            <select
              name="subject"
              value={formData.subject}
              onChange={handleChange}
              required
              className="w-full px-4 py-2 bg-slate-700/50 border border-slate-600 rounded-lg text-white focus:outline-none focus:border-fuchsia-500 focus:ring-1 focus:ring-fuchsia-500/50 transition-colors duration-200"
            >
              <option value="">Sélectionner un sujet...</option>
              <option value="support">Support Technique</option>
              <option value="billing">Facturation</option>
              <option value="partnership">Partenariat</option>
              <option value="feedback">Retour sur le produit</option>
              <option value="other">Autre</option>
            </select>
          </div>

          {/* Message */}
          <div>
            <label className="block text-sm font-medium text-white mb-2">Message *</label>
            <textarea
              name="message"
              value={formData.message}
              onChange={handleChange}
              required
              rows={6}
              className="w-full px-4 py-2 bg-slate-700/50 border border-slate-600 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:border-fuchsia-500 focus:ring-1 focus:ring-fuchsia-500/50 transition-colors duration-200 resize-none"
              placeholder="Votre message..."
            />
          </div>

          {/* Submit Button */}
          <button
            type="submit"
            disabled={loading}
            className="w-full flex items-center justify-center gap-2 px-6 py-3 bg-gradient-to-r from-fuchsia-600 to-fuchsia-700 hover:from-fuchsia-700 hover:to-fuchsia-800 disabled:from-slate-600 disabled:to-slate-700 text-white font-semibold rounded-lg transition-all duration-200 transform hover:scale-105 disabled:scale-100"
          >
            <Send className="w-4 h-4" />
            {loading ? "Envoi en cours..." : "Envoyer le Message"}
          </button>
        </form>
      </div>

      {/* FAQ Link */}
      <div className="mt-12 p-6 bg-slate-800/50 border border-slate-700 rounded-lg text-center">
        <p className="text-slate-300 mb-4">Vous cherchez des réponses rapides ?</p>
        <a href="/faq" className="text-fuchsia-500 hover:text-fuchsia-400 font-semibold transition-colors duration-200">
          Consultez notre FAQ →
        </a>
      </div>
    </div>
  );
}
