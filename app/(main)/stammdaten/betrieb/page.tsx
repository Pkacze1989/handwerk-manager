import { prisma } from "@/lib/db";
import { saveCompany } from "@/actions/master";
import { MasterNav } from "@/components/master-nav";
import { Card, Flash, PageHeader, btnPrimary, fieldClass, labelClass } from "@/components/ui";
import { one } from "@/lib/format";

export default async function CompanyPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const params = await searchParams;
  const company = await prisma.company.findUnique({ where: { id: "company" } });
  if (!company) return <p>Bitte zuerst den Seed ausführen.</p>;
  const fields: [string, string][] = [
    ["name", "Name"], ["street", "Straße"], ["zip", "PLZ"], ["city", "Ort"], ["phone", "Telefon"], ["email", "E-Mail"], ["website", "Website"],
    ["taxNumber", "Steuernummer"], ["vatId", "USt-IdNr."], ["bankName", "Bank"], ["iban", "IBAN"], ["bic", "BIC"], ["tradeRegister", "Register"], ["owner", "Inhaber"],
    ["datevBerater", "DATEV Berater"], ["datevMandant", "DATEV Mandant"], ["datevRevenueAccount", "Erlöskonto"], ["datevExpenseAccount", "Aufwandskonto"], ["datevBankAccount", "Bankkonto"], ["datevAccountLength", "Sachkontenlänge"],
  ];
  return (
    <div>
      <PageHeader eyebrow="Stammdaten" title="Betrieb" />
      <MasterNav current="/stammdaten/betrieb" />
      <Flash hinweis={one(params.hinweis)} />
      <Card>
        <form action={saveCompany} className="grid gap-3 md:grid-cols-2">
          {fields.map(([name, label]) => (
            <label key={name}><span className={labelClass}>{label}</span><input className={fieldClass} name={name} defaultValue={String(company[name as keyof typeof company] ?? "")} /></label>
          ))}
          <button className={btnPrimary}>Speichern</button>
        </form>
      </Card>
    </div>
  );
}
