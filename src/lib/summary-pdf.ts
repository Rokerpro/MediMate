/**
 * Saves the health summary as an A4 PDF file in the browser, without the print
 * dialog. Each direct child of `root` is drawn as one block and kept whole on a
 * page where it fits, so sections are not cut through the middle.
 * The libraries are loaded only when the user asks for a PDF.
 */
export async function downloadSummaryPdf(root: HTMLElement, fileName: string): Promise<void> {
  const [{ default: html2canvas }, { jsPDF }] = await Promise.all([
    import("html2canvas-pro"),
    import("jspdf"),
  ]);

  const pdf = new jsPDF({ unit: "mm", format: "a4", orientation: "portrait" });
  const pageWidth = pdf.internal.pageSize.getWidth();
  const pageHeight = pdf.internal.pageSize.getHeight();
  const margin = 12;
  const contentWidth = pageWidth - margin * 2;
  const bottom = pageHeight - margin;
  const gap = 4;
  let y = margin;

  const blocks = Array.from(root.children).filter(
    (child): child is HTMLElement => child instanceof HTMLElement && !child.hasAttribute("data-pdf-exclude"),
  );

  for (const block of blocks) {
    const canvas = await html2canvas(block, {
      scale: 2,
      backgroundColor: "#ffffff",
      // Draw in the light theme at a desktop width, whatever the viewer uses.
      windowWidth: 1100,
      ignoreElements: (element) => element.hasAttribute("data-pdf-exclude"),
      onclone: (clonedDocument) => {
        clonedDocument.documentElement.setAttribute("data-theme", "light");
        clonedDocument.documentElement.style.colorScheme = "light";
      },
    });
    if (canvas.width === 0 || canvas.height === 0) continue;

    const mmPerPx = contentWidth / canvas.width;
    const blockHeight = canvas.height * mmPerPx;

    // Start a new page when the block would not fit but would fit on a fresh page.
    if (y + blockHeight > bottom && y > margin && blockHeight <= bottom - margin) {
      pdf.addPage();
      y = margin;
    }

    if (y + blockHeight <= bottom) {
      pdf.addImage(canvas, "PNG", margin, y, contentWidth, blockHeight);
      y += blockHeight + gap;
      continue;
    }

    // Taller than one page: slice it across pages.
    let sourceY = 0;
    while (sourceY < canvas.height) {
      const room = bottom - y;
      const slicePx = Math.min(canvas.height - sourceY, Math.floor(room / mmPerPx));
      const slice = document.createElement("canvas");
      slice.width = canvas.width;
      slice.height = slicePx;
      slice.getContext("2d")?.drawImage(canvas, 0, sourceY, canvas.width, slicePx, 0, 0, canvas.width, slicePx);
      pdf.addImage(slice, "PNG", margin, y, contentWidth, slicePx * mmPerPx);
      sourceY += slicePx;
      y += slicePx * mmPerPx + gap;
      if (sourceY < canvas.height) {
        pdf.addPage();
        y = margin;
      }
    }
  }

  const pages = pdf.getNumberOfPages();
  for (let page = 1; page <= pages; page += 1) {
    pdf.setPage(page);
    pdf.setFontSize(8);
    pdf.setTextColor(110, 120, 112);
    pdf.text("MediMate · patient-provided summary · not a diagnosis · synthetic demo data", margin, pageHeight - 5);
    pdf.text(`${page} / ${pages}`, pageWidth - margin, pageHeight - 5, { align: "right" });
  }

  pdf.save(fileName);
}
