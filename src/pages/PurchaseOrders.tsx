import { useEffect } from "react";
import { useNavigate } from "react-router-dom";

export default function PurchaseOrders() {
  const navigate = useNavigate();
  useEffect(() => { navigate("/purchase-proforma", { replace: true }); }, [navigate]);
  return null;
}
