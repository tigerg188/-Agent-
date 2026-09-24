import {
  Document,
  Packer,
  Paragraph,
  TextRun,
  HeadingLevel,
  Table,
  TableRow,
  TableCell,
  WidthType,
  BorderStyle,
  AlignmentType,
  ShadingType,
  Footer,
  PageNumber,
} from 'docx';

function parseInlineFormatting(text: string): TextRun[] {
  const runs: TextRun[] = [];
  // Tokenize by bold **...** and inline code `...`
  const regex = /(\*\*.*?\*\*|`.*?`|\*.*?\*)/g;
  const parts = text.split(regex);

  for (const part of parts) {
    if (!part) continue;
    if (part.startsWith('**') && part.endsWith('**') && part.length >= 4) {
      runs.push(
        new TextRun({
          text: part.slice(2, -2),
          bold: true,
          font: 'Microsoft YaHei',
          size: 22, // 11pt
          color: '1E293B',
        })
      );
    } else if (part.startsWith('`') && part.endsWith('`') && part.length >= 2) {
      runs.push(
        new TextRun({
          text: part.slice(1, -1),
          font: 'Consolas',
          size: 20, // 10pt
          color: '0F172A',
          shading: {
            type: ShadingType.CLEAR,
            fill: 'F1F5F9',
          },
        })
      );
    } else if (part.startsWith('*') && part.endsWith('*') && part.length >= 2) {
      runs.push(
        new TextRun({
          text: part.slice(1, -1),
          italics: true,
          font: 'Microsoft YaHei',
          size: 22,
          color: '334155',
        })
      );
    } else {
      runs.push(
        new TextRun({
          text: part,
          font: 'Microsoft YaHei',
          size: 22, // 11pt
          color: '334155',
        })
      );
    }
  }

  return runs.length > 0
    ? runs
    : [
        new TextRun({
          text,
          font: 'Microsoft YaHei',
          size: 22,
          color: '334155',
        }),
      ];
}

export async function convertMarkdownToDocx(markdownText: string, title?: string): Promise<Buffer> {
  const lines = markdownText.split('\n');
  const children: (Paragraph | Table)[] = [];

  let i = 0;
  while (i < lines.length) {
    const rawLine = lines[i];
    const line = rawLine.trim();

    if (!line) {
      // Empty line spacing
      i++;
      continue;
    }

    // Markdown Table detection: starts with '|' and ends with '|'
    if (line.startsWith('|') && line.endsWith('|')) {
      const tableLines: string[] = [];
      while (i < lines.length && lines[i].trim().startsWith('|') && lines[i].trim().endsWith('|')) {
        tableLines.push(lines[i].trim());
        i++;
      }

      // Filter separator lines like |---|---|
      const dataRows = tableLines.filter((l) => !/^\|(\s*:?-+:?\s*\|)+$/.test(l));

      if (dataRows.length > 0) {
        const tableObj = new Table({
          width: {
            size: 100,
            type: WidthType.PERCENTAGE,
          },
          borders: {
            top: { style: BorderStyle.SINGLE, size: 4, color: 'CBD5E1' },
            bottom: { style: BorderStyle.SINGLE, size: 4, color: 'CBD5E1' },
            left: { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' },
            right: { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' },
            insideHorizontal: { style: BorderStyle.SINGLE, size: 2, color: 'E2E8F0' },
            insideVertical: { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' },
          },
          rows: dataRows.map((rowText, rowIdx) => {
            const cells = rowText
              .slice(1, -1)
              .split('|')
              .map((c) => c.trim());
            const isHeader = rowIdx === 0;

            return new TableRow({
              tableHeader: isHeader,
              children: cells.map((cellText) => {
                return new TableCell({
                  shading: isHeader
                    ? { fill: 'F1F5F9', type: ShadingType.CLEAR }
                    : rowIdx % 2 === 1
                    ? { fill: 'FAFAFA', type: ShadingType.CLEAR }
                    : undefined,
                  margins: {
                    top: 140,
                    bottom: 140,
                    left: 140,
                    right: 140,
                  },
                  children: [
                    new Paragraph({
                      children: [
                        new TextRun({
                          text: cellText,
                          bold: isHeader,
                          font: 'Microsoft YaHei',
                          size: isHeader ? 22 : 20,
                          color: isHeader ? '0F172A' : '334155',
                        }),
                      ],
                      spacing: { before: 60, after: 60 },
                    }),
                  ],
                });
              }),
            });
          }),
        });

        children.push(tableObj);
        // Add spacing after table
        children.push(new Paragraph({ spacing: { after: 120 } }));
      }
      continue;
    }

    // Heading 1: # ...
    if (line.startsWith('# ')) {
      children.push(
        new Paragraph({
          heading: HeadingLevel.HEADING_1,
          children: [
            new TextRun({
              text: line.slice(2).trim(),
              bold: true,
              font: 'Microsoft YaHei',
              size: 36, // 18pt
              color: '0F172A',
            }),
          ],
          spacing: { before: 280, after: 140 },
        })
      );
      i++;
      continue;
    }

    // Heading 2: ## ...
    if (line.startsWith('## ')) {
      children.push(
        new Paragraph({
          heading: HeadingLevel.HEADING_2,
          children: [
            new TextRun({
              text: line.slice(3).trim(),
              bold: true,
              font: 'Microsoft YaHei',
              size: 28, // 14pt
              color: '1E293B',
            }),
          ],
          spacing: { before: 240, after: 100 },
        })
      );
      i++;
      continue;
    }

    // Heading 3: ### ...
    if (line.startsWith('### ')) {
      children.push(
        new Paragraph({
          heading: HeadingLevel.HEADING_3,
          children: [
            new TextRun({
              text: line.slice(4).trim(),
              bold: true,
              font: 'Microsoft YaHei',
              size: 24, // 12pt
              color: '334155',
            }),
          ],
          spacing: { before: 180, after: 80 },
        })
      );
      i++;
      continue;
    }

    // Heading 4: #### ...
    if (line.startsWith('#### ')) {
      children.push(
        new Paragraph({
          heading: HeadingLevel.HEADING_4,
          children: [
            new TextRun({
              text: line.slice(5).trim(),
              bold: true,
              font: 'Microsoft YaHei',
              size: 22, // 11pt
              color: '475569',
            }),
          ],
          spacing: { before: 140, after: 60 },
        })
      );
      i++;
      continue;
    }

    // Bullet lists: - ... or * ...
    if (/^[-*]\s+/.test(line)) {
      const bulletContent = line.replace(/^[-*]\s+/, '').trim();
      children.push(
        new Paragraph({
          bullet: {
            level: 0,
          },
          children: parseInlineFormatting(bulletContent),
          spacing: { before: 40, after: 40, line: 360 },
        })
      );
      i++;
      continue;
    }

    // Numbered lists: 1. ... 2. ...
    if (/^\d+\.\s+/.test(line)) {
      const numberContent = line.replace(/^\d+\.\s+/, '').trim();
      children.push(
        new Paragraph({
          children: [
            new TextRun({
              text: line.match(/^\d+\./)![0] + ' ',
              bold: true,
              font: 'Microsoft YaHei',
              size: 22,
              color: '2563EB',
            }),
            ...parseInlineFormatting(numberContent),
          ],
          indent: { left: 360 },
          spacing: { before: 40, after: 40, line: 360 },
        })
      );
      i++;
      continue;
    }

    // Blockquote: > ...
    if (line.startsWith('> ')) {
      const quoteText = line.slice(2).trim();
      children.push(
        new Paragraph({
          indent: { left: 720 },
          children: [
            new TextRun({
              text: quoteText,
              italics: true,
              font: 'Microsoft YaHei',
              size: 20,
              color: '64748B',
            }),
          ],
          spacing: { before: 80, after: 80, line: 360 },
        })
      );
      i++;
      continue;
    }

    // Horizontal Rule: --- or ***
    if (/^---+$/.test(line) || /^\*\*\*+$/.test(line)) {
      children.push(
        new Paragraph({
          border: {
            bottom: {
              color: 'CBD5E1',
              size: 6,
              style: BorderStyle.SINGLE,
            },
          },
          spacing: { before: 160, after: 160 },
        })
      );
      i++;
      continue;
    }

    // Normal paragraph
    children.push(
      new Paragraph({
        children: parseInlineFormatting(line),
        spacing: { before: 60, after: 100, line: 360 },
      })
    );
    i++;
  }

  const doc = new Document({
    title: title || 'AI Agent 研报成果',
    description: '由个人 AI Agent 工作台自动生成的分析研究报告',
    sections: [
      {
        properties: {
          page: {
            margin: {
              top: 1440, // 1 inch
              bottom: 1440,
              left: 1440,
              right: 1440,
            },
          },
        },
        footers: {
          default: new Footer({
            children: [
              new Paragraph({
                alignment: AlignmentType.CENTER,
                children: [
                  new TextRun({
                    text: '第 ',
                    font: 'Microsoft YaHei',
                    size: 18,
                    color: '94A3B8',
                  }),
                  new TextRun({
                    children: [PageNumber.CURRENT],
                    font: 'Microsoft YaHei',
                    size: 18,
                    color: '94A3B8',
                  }),
                  new TextRun({
                    text: ' 页 · 个人 Agent 自动化产出',
                    font: 'Microsoft YaHei',
                    size: 18,
                    color: '94A3B8',
                  }),
                ],
              }),
            ],
          }),
        },
        children,
      },
    ],
  });

  return await Packer.toBuffer(doc);
}
