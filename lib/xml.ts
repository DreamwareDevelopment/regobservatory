import { parseString } from 'xml2js';

// Function to parse XML and handle dynamic structure with a callback
export function parseXMLText(xmlData: string): string[] {
  const text: string[] = [];
  parseString(xmlData, (err, result) => {
    if (err) {
      console.error('Error parsing XML:', err);
      return;
    }

    // Check if DIV8 exists
    if (result.DIV8) {
      const div8 = result.DIV8;

      // Extract HEAD text if it exists
      const headText = div8.HEAD ? div8.HEAD[0] : '';
      if (headText) {
        text.push(headText);
      }

      // Extract paragraphs if they exist
      if (div8.P) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        div8.P.forEach((p: any) => {
          const paragraphText = p._ || '';
          if (paragraphText) {
            text.push(paragraphText);
          }
        });
      }
    }
  });
  return text;
}

export function convertXMLToHTML(xmlData: string): string {
  let htmlOutput = '';

  parseString(xmlData, (err, result) => {
    if (err) {
      console.error('Error parsing XML:', err);
      return;
    }

    // Check if DIV8 exists
    if (result.DIV8) {
      const div8 = result.DIV8;

      // Start HTML structure
      htmlOutput += '<div class="section">';

      // Add section attributes
      const sectionNumber = div8.$?.N || '';
      const sectionType = div8.$?.TYPE || '';
      const hierarchyMetadata = div8.$?.hierarchy_metadata || '';

      if (sectionNumber) {
        htmlOutput += `<h2>Section Number: ${sectionNumber}</h2>`;
      }
      if (sectionType) {
        htmlOutput += `<p>Type: ${sectionType}</p>`;
      }
      if (hierarchyMetadata) {
        htmlOutput += `<p>Metadata: ${hierarchyMetadata}</p>`;
      }

      // Add HEAD text if it exists
      const headText = div8.HEAD ? div8.HEAD[0] : '';
      if (headText) {
        htmlOutput += `<h3>${headText}</h3>`;
      }

      // Add paragraphs if they exist
      if (div8.P) {
        htmlOutput += '<div class="paragraphs">';
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        div8.P.forEach((p: any) => {
          const paragraphText = p._ || '';
          if (paragraphText) {
            htmlOutput += `<p>${paragraphText}</p>`;
          }
        });
        htmlOutput += '</div>';
      }

      // Add citation if it exists
      const citation = div8.CITA ? div8.CITA[0]._?.trim() : '';
      if (citation) {
        htmlOutput += `<p class="citation">${citation}</p>`;
      }

      // Close HTML structure
      htmlOutput += '</div>';
    }
  });

  return htmlOutput;
}
