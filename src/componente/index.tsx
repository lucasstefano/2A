import jsPDF from "jspdf";

function exportAllConversationsToPDF() {
  const doc = new jsPDF({ unit: "pt", format: "a4" });
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();

  const margin = 40;
  let y = margin;

  const writeLine = (text: string, fontSize = 11) => {
    doc.setFontSize(fontSize);

    const lines = doc.splitTextToSize(text, pageWidth - margin * 2);
    for (const line of lines) {
      if (y > pageHeight - margin) {
        doc.addPage();
        y = margin;
      }
      doc.text(line, margin, y);
      y += fontSize + 6;
    }
  };

  // Cabeçalho
  doc.setFontSize(16);
  doc.text("Luna Multi-Tester — Relatório de Conversas", margin, y);
  y += 22;
  doc.setFontSize(10);
  doc.text(`Gerado em: ${new Date().toLocaleString("pt-BR")}`, margin, y);
  y += 18;

  // Conteúdo por cenário
  SCENARIOS.forEach((s, idx) => {
    const sim = simulations[s.id];

    if (y > pageHeight - margin) {
      doc.addPage();
      y = margin;
    }

    doc.setFontSize(13);
    doc.text(`${idx + 1}. ${s.name}`, margin, y);
    y += 16;

    doc.setFontSize(10);
    doc.text(`Status: ${String(sim.status).toUpperCase()}`, margin, y);
    y += 14;

    if (!sim.messages || sim.messages.length === 0) {
      writeLine("Sem mensagens (não rodou ou foi interrompido).", 10);
      y += 10;
      return;
    }

    // Transcript
    sim.messages.forEach((m) => {
      const tag =
        m.role === "HUMANO" ? "HUMANO" :
        m.role === "LUNA" ? "LUNA" :
        "SYSTEM";

      writeLine(`[${tag}] ${m.text}`, 10);
      y += 4;
    });

    y += 14;
    writeLine("────────────────────────────────────────", 10);
    y += 10;
  });

  doc.save(`luna-multitester-relatorio-${Date.now()}.pdf`);
}
