import { round2 } from "./money";

export type InvoiceParty = {
  name: string;
  street: string;
  zip: string;
  city: string;
  email: string;
  phone: string;
  vatId?: string;
  contact?: string;
  companyId?: string;
  buyerReference?: string;
};

export type InvoiceLine = {
  title: string;
  quantity: number;
  unit: string;
  unitPrice: number;
  total: number;
};

export type InvoiceXmlInput = {
  number: string;
  issueDate: string;
  dueDate: string;
  typeLabel: string;
  currency?: string;
  taxRate: number;
  net: number;
  tax: number;
  gross: number;
  buyerReference: string;
  iban: string;
  bic: string;
  bankName: string;
  seller: InvoiceParty;
  buyer: InvoiceParty;
  lines: InvoiceLine[];
};

function esc(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function money(value: number) {
  return round2(value).toFixed(2);
}

export function unitCode(unit: string) {
  const normalized = unit.toLowerCase().replace("²", "2").replace("³", "3").replace(".", "");
  if (normalized === "m2" || normalized === "qm") return "MTK";
  if (normalized === "m3") return "MTQ";
  if (normalized === "m" || normalized === "meter") return "MTR";
  if (normalized === "h" || normalized === "std") return "HUR";
  if (normalized === "kg") return "KGM";
  return "C62";
}

function compactDate(iso: string) {
  return iso.replace(/-/g, "");
}

export function buildXRechnungUbl(input: InvoiceXmlInput) {
  const currency = input.currency ?? "EUR";
  const lines = input.lines
    .map((line, index) => {
      return `  <cac:InvoiceLine>
    <cbc:ID>${index + 1}</cbc:ID>
    <cbc:InvoicedQuantity unitCode="${unitCode(line.unit)}">${line.quantity}</cbc:InvoicedQuantity>
    <cbc:LineExtensionAmount currencyID="${currency}">${money(line.total)}</cbc:LineExtensionAmount>
    <cac:Item>
      <cbc:Name>${esc(line.title)}</cbc:Name>
      <cac:ClassifiedTaxCategory>
        <cbc:ID>S</cbc:ID>
        <cbc:Percent>${money(input.taxRate)}</cbc:Percent>
        <cac:TaxScheme><cbc:ID>VAT</cbc:ID></cac:TaxScheme>
      </cac:ClassifiedTaxCategory>
    </cac:Item>
    <cac:Price>
      <cbc:PriceAmount currencyID="${currency}">${money(line.unitPrice)}</cbc:PriceAmount>
    </cac:Price>
  </cac:InvoiceLine>`;
    })
    .join("\n");

  return `<?xml version="1.0" encoding="UTF-8"?>
<ubl:Invoice xmlns:ubl="urn:oasis:names:specification:ubl:schema:xsd:Invoice-2" xmlns:cac="urn:oasis:names:specification:ubl:schema:xsd:CommonAggregateComponents-2" xmlns:cbc="urn:oasis:names:specification:ubl:schema:xsd:CommonBasicComponents-2">
  <cbc:CustomizationID>urn:cen.eu:en16931:2017#compliant#urn:xeinkauf.de:kosit:xrechnung_3.0</cbc:CustomizationID>
  <cbc:ProfileID>urn:fdc:peppol.eu:2017:poacc:billing:01:1.0</cbc:ProfileID>
  <cbc:ID>${esc(input.number)}</cbc:ID>
  <cbc:IssueDate>${esc(input.issueDate)}</cbc:IssueDate>
  <cbc:DueDate>${esc(input.dueDate)}</cbc:DueDate>
  <cbc:InvoiceTypeCode>380</cbc:InvoiceTypeCode>
  <cbc:Note>${esc(input.typeLabel)}. Erzeugt mit Werkplan, strukturell an XRechnung 3.0 / UBL angelehnt, ohne Kosit-Prüfbericht.</cbc:Note>
  <cbc:DocumentCurrencyCode>${currency}</cbc:DocumentCurrencyCode>
  <cbc:BuyerReference>${esc(input.buyerReference)}</cbc:BuyerReference>
  <cac:AccountingSupplierParty>
    <cac:Party>
      <cbc:EndpointID schemeID="EM">${esc(input.seller.email)}</cbc:EndpointID>
      <cac:PartyName><cbc:Name>${esc(input.seller.name)}</cbc:Name></cac:PartyName>
      <cac:PostalAddress>
        <cbc:StreetName>${esc(input.seller.street)}</cbc:StreetName>
        <cbc:CityName>${esc(input.seller.city)}</cbc:CityName>
        <cbc:PostalZone>${esc(input.seller.zip)}</cbc:PostalZone>
        <cac:Country><cbc:IdentificationCode>DE</cbc:IdentificationCode></cac:Country>
      </cac:PostalAddress>
      ${input.seller.vatId ? `<cac:PartyTaxScheme><cbc:CompanyID>${esc(input.seller.vatId)}</cbc:CompanyID><cac:TaxScheme><cbc:ID>VAT</cbc:ID></cac:TaxScheme></cac:PartyTaxScheme>` : ""}
      <cac:PartyLegalEntity>
        <cbc:RegistrationName>${esc(input.seller.name)}</cbc:RegistrationName>
        ${input.seller.companyId ? `<cbc:CompanyID>${esc(input.seller.companyId)}</cbc:CompanyID>` : ""}
      </cac:PartyLegalEntity>
      <cac:Contact>
        <cbc:Name>${esc(input.seller.contact || input.seller.name)}</cbc:Name>
        <cbc:Telephone>${esc(input.seller.phone)}</cbc:Telephone>
        <cbc:ElectronicMail>${esc(input.seller.email)}</cbc:ElectronicMail>
      </cac:Contact>
    </cac:Party>
  </cac:AccountingSupplierParty>
  <cac:AccountingCustomerParty>
    <cac:Party>
      ${input.buyer.email ? `<cbc:EndpointID schemeID="EM">${esc(input.buyer.email)}</cbc:EndpointID>` : ""}
      <cac:PartyName><cbc:Name>${esc(input.buyer.name)}</cbc:Name></cac:PartyName>
      <cac:PostalAddress>
        <cbc:StreetName>${esc(input.buyer.street)}</cbc:StreetName>
        <cbc:CityName>${esc(input.buyer.city)}</cbc:CityName>
        <cbc:PostalZone>${esc(input.buyer.zip)}</cbc:PostalZone>
        <cac:Country><cbc:IdentificationCode>DE</cbc:IdentificationCode></cac:Country>
      </cac:PostalAddress>
      ${input.buyer.vatId ? `<cac:PartyTaxScheme><cbc:CompanyID>${esc(input.buyer.vatId)}</cbc:CompanyID><cac:TaxScheme><cbc:ID>VAT</cbc:ID></cac:TaxScheme></cac:PartyTaxScheme>` : ""}
      <cac:PartyLegalEntity><cbc:RegistrationName>${esc(input.buyer.name)}</cbc:RegistrationName></cac:PartyLegalEntity>
    </cac:Party>
  </cac:AccountingCustomerParty>
  <cac:PaymentMeans>
    <cbc:PaymentMeansCode>58</cbc:PaymentMeansCode>
    <cac:PayeeFinancialAccount>
      <cbc:ID>${esc(input.iban.replace(/\s/g, ""))}</cbc:ID>
      <cbc:Name>${esc(input.seller.name)}</cbc:Name>
      <cac:FinancialInstitutionBranch><cbc:ID>${esc(input.bic)}</cbc:ID></cac:FinancialInstitutionBranch>
    </cac:PayeeFinancialAccount>
  </cac:PaymentMeans>
  <cac:PaymentTerms>
    <cbc:Note>Zahlbar bis ${esc(input.dueDate)} ohne Abzug. Bank: ${esc(input.bankName)}.</cbc:Note>
  </cac:PaymentTerms>
  <cac:TaxTotal>
    <cbc:TaxAmount currencyID="${currency}">${money(input.tax)}</cbc:TaxAmount>
    <cac:TaxSubtotal>
      <cbc:TaxableAmount currencyID="${currency}">${money(input.net)}</cbc:TaxableAmount>
      <cbc:TaxAmount currencyID="${currency}">${money(input.tax)}</cbc:TaxAmount>
      <cac:TaxCategory>
        <cbc:ID>S</cbc:ID>
        <cbc:Percent>${money(input.taxRate)}</cbc:Percent>
        <cac:TaxScheme><cbc:ID>VAT</cbc:ID></cac:TaxScheme>
      </cac:TaxCategory>
    </cac:TaxSubtotal>
  </cac:TaxTotal>
  <cac:LegalMonetaryTotal>
    <cbc:LineExtensionAmount currencyID="${currency}">${money(input.net)}</cbc:LineExtensionAmount>
    <cbc:TaxExclusiveAmount currencyID="${currency}">${money(input.net)}</cbc:TaxExclusiveAmount>
    <cbc:TaxInclusiveAmount currencyID="${currency}">${money(input.gross)}</cbc:TaxInclusiveAmount>
    <cbc:PayableAmount currencyID="${currency}">${money(input.gross)}</cbc:PayableAmount>
  </cac:LegalMonetaryTotal>
${lines}
</ubl:Invoice>
`;
}

export function buildZugferdCii(input: InvoiceXmlInput) {
  const lines = input.lines
    .map((line, index) => {
      return `    <ram:IncludedSupplyChainTradeLineItem>
      <ram:AssociatedDocumentLineDocument><ram:LineID>${index + 1}</ram:LineID></ram:AssociatedDocumentLineDocument>
      <ram:SpecifiedTradeProduct><ram:Name>${esc(line.title)}</ram:Name></ram:SpecifiedTradeProduct>
      <ram:SpecifiedLineTradeAgreement>
        <ram:NetPriceProductTradePrice><ram:ChargeAmount>${money(line.unitPrice)}</ram:ChargeAmount></ram:NetPriceProductTradePrice>
      </ram:SpecifiedLineTradeAgreement>
      <ram:SpecifiedLineTradeDelivery>
        <ram:BilledQuantity unitCode="${unitCode(line.unit)}">${line.quantity}</ram:BilledQuantity>
      </ram:SpecifiedLineTradeDelivery>
      <ram:SpecifiedLineTradeSettlement>
        <ram:ApplicableTradeTax>
          <ram:TypeCode>VAT</ram:TypeCode>
          <ram:CategoryCode>S</ram:CategoryCode>
          <ram:RateApplicablePercent>${money(input.taxRate)}</ram:RateApplicablePercent>
        </ram:ApplicableTradeTax>
        <ram:SpecifiedTradeSettlementLineMonetarySummation>
          <ram:LineTotalAmount>${money(line.total)}</ram:LineTotalAmount>
        </ram:SpecifiedTradeSettlementLineMonetarySummation>
      </ram:SpecifiedLineTradeSettlement>
    </ram:IncludedSupplyChainTradeLineItem>`;
    })
    .join("\n");

  return `<?xml version="1.0" encoding="UTF-8"?>
<rsm:CrossIndustryInvoice xmlns:rsm="urn:un:unece:uncefact:data:standard:CrossIndustryInvoice:100" xmlns:ram="urn:un:unece:uncefact:data:standard:ReusableAggregateBusinessInformationEntity:100" xmlns:udt="urn:un:unece:uncefact:data:standard:UnqualifiedDataType:100">
  <rsm:ExchangedDocumentContext>
    <ram:GuidelineSpecifiedDocumentContextParameter>
      <ram:ID>urn:cen.eu:en16931:2017#compliant#urn:factur-x.eu:1p0:basic</ram:ID>
    </ram:GuidelineSpecifiedDocumentContextParameter>
  </rsm:ExchangedDocumentContext>
  <rsm:ExchangedDocument>
    <ram:ID>${esc(input.number)}</ram:ID>
    <ram:TypeCode>380</ram:TypeCode>
    <ram:IssueDateTime><udt:DateTimeString format="102">${compactDate(input.issueDate)}</udt:DateTimeString></ram:IssueDateTime>
  </rsm:ExchangedDocument>
  <rsm:SupplyChainTradeTransaction>
${lines}
    <ram:ApplicableHeaderTradeAgreement>
      <ram:BuyerReference>${esc(input.buyerReference)}</ram:BuyerReference>
      <ram:SellerTradeParty>
        <ram:Name>${esc(input.seller.name)}</ram:Name>
        <ram:PostalTradeAddress>
          <ram:PostcodeCode>${esc(input.seller.zip)}</ram:PostcodeCode>
          <ram:LineOne>${esc(input.seller.street)}</ram:LineOne>
          <ram:CityName>${esc(input.seller.city)}</ram:CityName>
          <ram:CountryID>DE</ram:CountryID>
        </ram:PostalTradeAddress>
        ${input.seller.vatId ? `<ram:SpecifiedTaxRegistration><ram:ID schemeID="VA">${esc(input.seller.vatId)}</ram:ID></ram:SpecifiedTaxRegistration>` : ""}
      </ram:SellerTradeParty>
      <ram:BuyerTradeParty>
        <ram:Name>${esc(input.buyer.name)}</ram:Name>
        <ram:PostalTradeAddress>
          <ram:PostcodeCode>${esc(input.buyer.zip)}</ram:PostcodeCode>
          <ram:LineOne>${esc(input.buyer.street)}</ram:LineOne>
          <ram:CityName>${esc(input.buyer.city)}</ram:CityName>
          <ram:CountryID>DE</ram:CountryID>
        </ram:PostalTradeAddress>
      </ram:BuyerTradeParty>
    </ram:ApplicableHeaderTradeAgreement>
    <ram:ApplicableHeaderTradeDelivery>
      <ram:ActualDeliverySupplyChainEvent>
        <ram:OccurrenceDateTime><udt:DateTimeString format="102">${compactDate(input.issueDate)}</udt:DateTimeString></ram:OccurrenceDateTime>
      </ram:ActualDeliverySupplyChainEvent>
    </ram:ApplicableHeaderTradeDelivery>
    <ram:ApplicableHeaderTradeSettlement>
      <ram:InvoiceCurrencyCode>${input.currency ?? "EUR"}</ram:InvoiceCurrencyCode>
      <ram:SpecifiedTradeSettlementPaymentMeans>
        <ram:TypeCode>58</ram:TypeCode>
        <ram:PayeePartyCreditorFinancialAccount>
          <ram:IBANID>${esc(input.iban.replace(/\s/g, ""))}</ram:IBANID>
        </ram:PayeePartyCreditorFinancialAccount>
        <ram:PayeeSpecifiedCreditorFinancialInstitution>
          <ram:BICID>${esc(input.bic)}</ram:BICID>
        </ram:PayeeSpecifiedCreditorFinancialInstitution>
      </ram:SpecifiedTradeSettlementPaymentMeans>
      <ram:ApplicableTradeTax>
        <ram:CalculatedAmount>${money(input.tax)}</ram:CalculatedAmount>
        <ram:TypeCode>VAT</ram:TypeCode>
        <ram:BasisAmount>${money(input.net)}</ram:BasisAmount>
        <ram:CategoryCode>S</ram:CategoryCode>
        <ram:RateApplicablePercent>${money(input.taxRate)}</ram:RateApplicablePercent>
      </ram:ApplicableTradeTax>
      <ram:SpecifiedTradePaymentTerms>
        <ram:Description>Zahlbar bis ${esc(input.dueDate)} ohne Abzug.</ram:Description>
        <ram:DueDateDateTime><udt:DateTimeString format="102">${compactDate(input.dueDate)}</udt:DateTimeString></ram:DueDateDateTime>
      </ram:SpecifiedTradePaymentTerms>
      <ram:SpecifiedTradeSettlementHeaderMonetarySummation>
        <ram:LineTotalAmount>${money(input.net)}</ram:LineTotalAmount>
        <ram:TaxBasisTotalAmount>${money(input.net)}</ram:TaxBasisTotalAmount>
        <ram:TaxTotalAmount currencyID="${input.currency ?? "EUR"}">${money(input.tax)}</ram:TaxTotalAmount>
        <ram:GrandTotalAmount>${money(input.gross)}</ram:GrandTotalAmount>
        <ram:DuePayableAmount>${money(input.gross)}</ram:DuePayableAmount>
      </ram:SpecifiedTradeSettlementHeaderMonetarySummation>
    </ram:ApplicableHeaderTradeSettlement>
  </rsm:SupplyChainTradeTransaction>
</rsm:CrossIndustryInvoice>
`;
}
