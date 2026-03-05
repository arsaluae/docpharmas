import { useEffect } from "react";
import { useNavigate } from "react-router-dom";

export default function SalesInvoices() {
  const navigate = useNavigate();
  useEffect(() => { navigate("/proforma", { replace: true }); }, [navigate]);
  return null;
}
