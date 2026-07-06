import { useEffect, useState } from "react";
import { Plus, Search } from "lucide-react";

import { ReusableModal } from "../components/ReusableModal";
import { createCustomer, listCustomers, updateCustomer, type Customer, type CustomerPayload } from "../services/customerService";

const emptyCustomer: CustomerPayload = { name: "", phone: "", address: "", email: "", document_number: "" };

export function CustomersPage() {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [search, setSearch] = useState("");
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Customer | null>(null);
  const [form, setForm] = useState<CustomerPayload>(emptyCustomer);

  async function load() { setCustomers(await listCustomers(search)); }
  useEffect(() => { load(); }, []);

  async function save() {
    if (editing) await updateCustomer(editing.id, form);
    else await createCustomer(form);
    setModalOpen(false);
    await load();
  }

  return (
    <section className="space-y-5 p-8">
      <div className="flex items-center justify-between">
        <div><h2 className="text-2xl font-semibold text-gray-900">Clientes</h2><p className="text-sm text-gray-500">Consulta y gestiona clientes para ventas.</p></div>
        <button onClick={() => { setEditing(null); setForm(emptyCustomer); setModalOpen(true); }} className="inline-flex items-center gap-2 rounded-lg bg-[#1B8A5A] px-4 py-2 text-white"><Plus className="h-4 w-4" /> Crear cliente</button>
      </div>
      <div className="relative max-w-xl"><Search className="absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-gray-400" /><input value={search} onChange={(e) => setSearch(e.target.value)} onKeyDown={(e) => e.key === "Enter" && load()} placeholder="Buscar cliente" className="w-full rounded-lg border border-gray-300 py-3 pl-11 pr-4" /></div>
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">{customers.map((customer) => <button key={customer.id} onClick={() => { setEditing(customer); setForm(customer); setModalOpen(true); }} className="rounded-xl border border-gray-200 bg-white p-5 text-left shadow-sm"><h3 className="font-semibold text-gray-900">{customer.name}</h3><p className="text-sm text-gray-500">{customer.email ?? "Sin correo"}</p><p className="text-sm text-gray-500">{customer.phone ?? "Sin teléfono"}</p></button>)}</div>
      <ReusableModal open={modalOpen} title={editing ? "Editar cliente" : "Crear cliente"} onClose={() => setModalOpen(false)}>
        <form onSubmit={(e) => { e.preventDefault(); save(); }} className="grid gap-4 md:grid-cols-2">
          <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Nombre" className="rounded-lg border border-gray-300 px-3 py-2" />
          <input value={form.phone ?? ""} onChange={(e) => setForm({ ...form, phone: e.target.value })} placeholder="Teléfono" className="rounded-lg border border-gray-300 px-3 py-2" />
          <input value={form.email ?? ""} onChange={(e) => setForm({ ...form, email: e.target.value })} placeholder="Correo" className="rounded-lg border border-gray-300 px-3 py-2" />
          <input value={form.address ?? ""} onChange={(e) => setForm({ ...form, address: e.target.value })} placeholder="Dirección" className="rounded-lg border border-gray-300 px-3 py-2" />
          <button className="rounded-lg bg-[#1B8A5A] px-4 py-3 text-white md:col-span-2">Guardar</button>
        </form>
      </ReusableModal>
    </section>
  );
}
