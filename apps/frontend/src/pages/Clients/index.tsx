import { Route, Routes } from "react-router-dom";
import { ClientsList } from "./List";
import { ClientCreate } from "./Create";
import { ClientView } from "./View";

export default function ClientsPage() {
  return (
    <Routes>
      <Route path="/" element={<ClientsList />} />
      <Route path="/new" element={<ClientCreate />} />
      <Route path="/:id" element={<ClientView />} />
    </Routes>
  );
}
