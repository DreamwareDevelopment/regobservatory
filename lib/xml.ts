import { parseString } from 'xml2js';
import { ParsedXMLTextArray } from './zod/data';
import { Logger } from 'inngest/middleware/logger';

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export function parseXMLText(xmlData: string, logger: Logger): ParsedXMLTextArray {
  const text: ParsedXMLTextArray = [];

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  function processDiv(div: any, identifier: string, type: string) {
    // Extract type and identifier if they exist
    const currentIdentifier = div.$?.N ?? identifier;
    const currentType = div.$?.TYPE ?? type;
    // Extract paragraphs if they exist
    if (div.P) {
      // logger.info(`Paragraphs: ${div.P.toString()}`);
      const paragraphs: string[] = [];
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      div.P.forEach((p: any) => {
        const paragraphText = p._ || p.toString() || '';
        // logger.info(`Found paragraph for ${currentIdentifier}: ${paragraphText}`);
        if (paragraphText) {
          paragraphs.push(paragraphText);
        }
      });
      text.push({ type: currentType, identifier: currentIdentifier, text: paragraphs.join('\n') });
      // logger.info(`Found ${div.P.length} paragraphs for ${currentIdentifier}`);
    }

    // Recursively process any nested DIV elements
    Object.keys(div).forEach((key) => {
      if (key.startsWith('DIV')) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        div[key].forEach((nestedDiv: any) => {
          processDiv(nestedDiv, currentIdentifier, currentType);
        });
      }
    });
  }

  parseString(xmlData, (err, result) => {
    if (err) {
      console.error('Error parsing XML:', err);
      return;
    }

    // Start processing from the top-level DIV elements
    Object.keys(result).forEach((key) => {
      if (key.startsWith('DIV')) {
        const divs = Array.isArray(result[key]) ? result[key] : [result[key]];
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        divs.forEach((div: any) => {
          processDiv(div, '', '');
        });
      }
    });
  });

  return text;
}
