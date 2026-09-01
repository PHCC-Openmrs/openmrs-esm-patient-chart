import React from 'react';
import { useTranslation } from 'react-i18next';
import { type Drug } from '@openmrs/esm-patient-common-lib';
import { useStockQuantityForDrug } from './stock-availability.resource';
import styles from './stock-availability-info.scss';

interface StockAvailabilityInfoProps {
  drug?: Drug;
}

const StockAvailabilityInfo: React.FC<StockAvailabilityInfoProps> = ({ drug }) => {
  const { t } = useTranslation();
  const { stock, isLoading, error } = useStockQuantityForDrug(drug?.uuid);

  if (isLoading || error || !stock) {
    return null;
  }

  const isOutOfStock = stock.quantity <= 0;
  // stock.quantity is in the bulk packaging unit (quantityUoM, e.g. "Box") - convert it
  // into the dispensing unit (e.g. "Tablet") prescribers actually think in, using the
  // number of dispensing units per quantityUoM.
  const dispensingQuantity = stock.quantity * (stock.quantityFactor ?? 1);
  const dispensingUnit = stock.dispensingUnitName ?? stock.quantityUoM ?? '';

  return (
    <span className={isOutOfStock ? styles.outOfStock : styles.inStock}>
      &mdash;{' '}
      {isOutOfStock
        ? t('drugOutOfStock', 'Out of stock')
        : t('drugStockAvailable', 'In stock: {{quantity}} {{unit}}', {
            quantity: dispensingQuantity.toLocaleString(),
            unit: dispensingUnit,
          })}
    </span>
  );
};

export default StockAvailabilityInfo;
