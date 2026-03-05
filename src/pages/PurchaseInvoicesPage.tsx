import { useEffect } from "react";
import { useNavigate } from "react-router-dom";

export default function PurchaseInvoicesPage() {
  const navigate = useNavigate();
  useEffect(() => { navigate("/purchase-proforma", { replace: true }); }, [navigate]);
  return null;
}
