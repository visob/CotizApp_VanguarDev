import { Route, Routes } from "react-router-dom";
import { ProductsList } from "./List";
import { ProductCreate } from "./Create";

export default function ProductsPage() {
  return (
    <Routes>
      <Route path="/" element={<ProductsList />} />
      <Route path="/new" element={<ProductCreate />} />
    </Routes>
  );
}
