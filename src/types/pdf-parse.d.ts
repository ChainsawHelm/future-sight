declare module 'pdf-parse' {
  interface PDFResult {
    numpages: number;
    numrender: number;
    info: any;
    metadata: any;
    text: string;
    version: string;
  }
  function pdfParse(buffer: Buffer): Promise<PDFResult>;
  export = pdfParse;
}
