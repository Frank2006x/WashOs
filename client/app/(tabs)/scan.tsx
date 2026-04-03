import React from 'react';
import QRScanner from '../../components/QRScanner';
import { useTranslation } from "react-i18next";

export default function ScanScreen() {
  const { t } = useTranslation();
  return <QRScanner title={t("scan.title", "WashOs Scanner") as string} />;
}