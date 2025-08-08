import _ from "lodash";
import {PDFDocument} from "pdf-lib";


/*
 * Force having an array of not empty strings
 */
export const stringToNotEmptyArrayString = (value: string[] | string | undefined): string[] => {
  if (value && Array.isArray(value)) {
    return value.filter(v => v)
  } else if (value && _.isString(value) ) {
    return [value]
  } else {
    return []
  }
}

/*
 * A mix of lodash _.pick and _.get, thx stackoverflow people
 */
export const flatPick = (object: {}, paths: string[]) => {
  const o = {};

  paths.forEach(path => _.set(
    o,
    _.last(path.split('.'))!,
    _.get(object, path)
  ));

  return o;
}

export const mergePDFs = async (
  pdf1AsBase64: string,
  pdf2AsBase64: string,
) => {
  const pdfDoc1 = await PDFDocument.load(pdf1AsBase64)
  const pdfDoc2 = await PDFDocument.load(pdf2AsBase64)

  const mergedPdf = await PDFDocument.create()

  const copiedPagesA = await mergedPdf.copyPages(pdfDoc1, pdfDoc1.getPageIndices());
  copiedPagesA.forEach((page) => mergedPdf.addPage(page));

  const copiedPagesB = await mergedPdf.copyPages(pdfDoc2, pdfDoc2.getPageIndices());
  copiedPagesB.forEach((page) => mergedPdf.addPage(page));

  const mergedPdfFile = await mergedPdf.save();

  return Buffer.from(mergedPdfFile).toString('base64')
};
