import { prisma } from "@/lib/db";
import { deleteCustomer, saveCustomer } from "@/actions/master";
import { MasterNav } from "@/components/master-nav";
import { Card, Flash, PageHeader, btnDanger, btnPrimary, fieldClass, labelClass } from "@/components/ui";
import { one } from "@/lib/format";

export default async function CustomersPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const params = await searchParams;
  const editId = one(params.edit);
  const customers = await prisma.customer.findMany({ orderBy: { number: "asc" } });
  const editing = customers.find((customer) => customer.id === editId);
  return (
    <div>
      <PageHeader eyebrow="Stammdaten" title="Kunden" />
      <MasterNav current="/stammdaten/kunden" />
      <Flash hinweis={one(params.hinweis)} fehler={one(params.fehler)} />
      <div className="grid gap-6 lg:grid-cols-[320px_1fr]">
        <Card>
          <h2 className="font-serif text-2xl">{editing ? "Kunde ändern" : "Neuer Kunde"}</h2>
          <CustomerForm customer={editing} />
        </Card>
        <div className="overflow-x-auto rounded-3xl border border-line bg-white">
          <table className="w-full text-left text-sm">
            <thead className="text-xs uppercase text-muted"><tr><th className="px-4 py-3">Nr.</th><th className="px-4 py-3">Name</th><th className="px-4 py-3">Ort</th><th className="px-4 py-3">Debitor</th><th /></tr></thead>
            <tbody>
              {customers.map((customer) => (
                <tr key={customer.id} className="border-t border-line">
                  <td className="px-4 py-3">{customer.number}</td>
                  <td className="px-4 py-3"><a className="font-semibold text-spruce" href={`/stammdaten/kunden?edit=${customer.id}`}>{customer.name}</a><p className="text-xs text-muted">{customer.email}</p></td>
                  <td className="px-4 py-3">{customer.zip} {customer.city}</td>
                  <td className="px-4 py-3">{customer.debtorNo}</td>
                  <td className="px-4 py-3"><form action={deleteCustomer}><input type="hidden" name="id" value={customer.id} /><button className={btnDanger}>Löschen</button></form></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function CustomerForm({ customer }: { customer?: { id: string; number: string; name: string; contact: string | null; street: string | null; zip: string | null; city: string | null; email: string | null; phone: string | null; vatId: string | null; leitwegId: string | null; debtorNo: string | null; notes: string | null } }) {
  return (
    <form action={saveCustomer} className="mt-4 space-y-3">
      {customer ? <input type="hidden" name="id" value={customer.id} /> : null}
      <Field name="name" label="Name" value={customer?.name} required />
      <Field name="contact" label="Ansprechpartner" value={customer?.contact} />
      <Field name="street" label="Straße" value={customer?.street} />
      <div className="grid grid-cols-3 gap-2"><Field name="zip" label="PLZ" value={customer?.zip} /><div className="col-span-2"><Field name="city" label="Ort" value={customer?.city} /></div></div>
      <Field name="email" label="E-Mail" value={customer?.email} />
      <Field name="phone" label="Telefon" value={customer?.phone} />
      <Field name="vatId" label="USt-IdNr." value={customer?.vatId} />
      <Field name="leitwegId" label="Leitweg-ID" value={customer?.leitwegId} />
      <Field name="debtorNo" label="Debitor" value={customer?.debtorNo} />
      <label><span className={labelClass}>Notiz</span><textarea className={fieldClass} name="notes" defaultValue={customer?.notes ?? ""} rows={3} /></label>
      <button className={btnPrimary}>Speichern</button>
    </form>
  );
}

function Field({ name, label, value, required }: { name: string; label: string; value?: string | null; required?: boolean }) {
  return <label className="block"><span className={labelClass}>{label}</span><input className={fieldClass} name={name} defaultValue={value ?? ""} required={required} /></label>;
}
