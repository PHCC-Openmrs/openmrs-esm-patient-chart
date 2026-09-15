import React, { useState, useMemo, useRef } from 'react';
import classNames from 'classnames';
import { capitalize } from 'lodash-es';
import { Button, ModalBody, ModalFooter, Checkbox } from '@carbon/react';
import { useReactToPrint } from 'react-to-print';
import { useTranslation } from 'react-i18next';
import { useSession, usePatient, formatDatetime, parseDate } from '@openmrs/esm-framework';
import { type Order } from '@openmrs/esm-patient-common-lib';
import PrintableReport from '../print-preview/print-preview.component';
import careLogo from '../../../assets/care-logo.png';
import styles from './print-results-modal.scss';

type PrintResultsModalProps = {
  orders: Array<Order>;
  closeModal: () => void;
};

const PrintResultsModal: React.FC<PrintResultsModalProps> = ({ orders, closeModal }) => {
  const { t } = useTranslation();
  const [selectedOrders, setSelectedOrders] = useState<Set<string>>(new Set(orders.map((order) => order.uuid)));
  const contentToPrintRef = useRef<HTMLDivElement>(null);
  const setIsPrinting = useState(false)[1];
  const { sessionLocation } = useSession();
  const location = sessionLocation?.display;

  const handleOrderSelection = (orderId: string, isSelected: boolean) => {
    const newSelection = new Set(selectedOrders);
    if (isSelected) {
      newSelection.add(orderId);
    } else {
      newSelection.delete(orderId);
    }
    setSelectedOrders(newSelection);
  };

  const filteredOrders = useMemo(() => {
    return orders.filter((order) => selectedOrders.has(order.uuid));
  }, [orders, selectedOrders]);

  const handlePrint = useReactToPrint({
    content: () => contentToPrintRef.current,
    onBeforeGetContent: () => {
      setIsPrinting(true);
      return Promise.resolve();
    },
    onAfterPrint: () => {
      setIsPrinting(false);
    },
    // useReactToPrint's own default pageStyle sets `@page { margin: 0; }`, but passing a custom
    // pageStyle here REPLACES that default entirely rather than merging with it, so that rule has
    // to be restored explicitly below. Without it, the browser's default print margins apply on
    // top of an unconstrained root width, which is what caused the printed report to render in a
    // narrow column instead of filling the page.
    pageStyle: `
      @page {
        size: auto;
        margin: 0;
      }

      @media print {
        html, body {
          height: auto !important;
          width: 100% !important;
        }

        .${styles.printContent} {
          width: 100% !important;
          max-width: 100% !important;
        }
      }
    `,
  });
  const firstOrder = filteredOrders[0];
  const { patient } = usePatient(firstOrder?.patient?.uuid);
  const nationalId = patient?.identifier?.find(
    (identifier) =>
      identifier.type?.text === 'National ID' ||
      identifier.type?.coding?.some((coding) => coding.display === 'National ID'),
  )?.value;

  return (
    <>
      <ModalBody className={classNames(styles.modalBody, styles.modalContentWrapper)}>
        <div className={styles.selectionPanel}>
          <h4 className={styles.titleHeader}>{capitalize(t('selectTestsToPrint', 'Select tests to print'))}</h4>
          <div className={styles.checkboxList}>
            {orders.map((order) => (
              <Checkbox
                key={order.uuid}
                id={order.uuid}
                labelText={
                  <span className={styles.checkboxLabel}>
                    {capitalize(order.concept.display || order.concept.name?.display || '--')} ({order.orderNumber})
                  </span>
                }
                checked={selectedOrders.has(order.uuid)}
                onChange={(_, { checked }) => handleOrderSelection(order.uuid, checked)}
                className={styles.checkboxItem}
              />
            ))}
          </div>
        </div>

        <div className={styles.previewPanel}>
          <div ref={contentToPrintRef}>
            <div className={styles.printContent}>
              {filteredOrders.length > 0 && (
                <>
                  <img src={careLogo} alt="CARE logo" className={styles.careLogo} />
                  <div className={styles.printableHeader}>
                    <p className={styles.titleHeader}>{capitalize(t('laboratoryReport', 'Laboratory Report'))}</p>
                  </div>

                  <div className={styles.patientInfoGrid}>
                    <div className={styles.patientInfoRow}>
                      <p className={styles.itemLabel}>
                        <span className={styles.infoLabel}>{capitalize(t('name', 'Name'))}</span>:{' '}
                        {firstOrder?.patient?.person?.display}
                      </p>
                      {nationalId && (
                        <p className={styles.itemLabel}>
                          <span className={styles.infoLabel}>{capitalize(t('nationalId', 'National ID'))}</span>:{' '}
                          {nationalId}
                        </p>
                      )}
                    </div>
                    <div className={styles.patientInfoRow}>
                      <div>
                        <p className={styles.itemLabel}>
                          <span className={styles.infoLabel}>{capitalize(t('gender', 'Gender'))}</span>:{' '}
                          {capitalize(firstOrder?.patient?.person?.gender === 'M' ? 'Male' : 'Female')}
                        </p>
                        <p className={styles.itemLabel}>
                          <span className={styles.infoLabel}>{capitalize(t('age', 'Age'))}</span>:{' '}
                          {firstOrder?.patient?.person?.age}
                        </p>
                      </div>
                      <div className={styles.facilityDetails}>
                        <p className={styles.itemLabel}>{capitalize(location)}</p>
                        <p className={styles.itemLabel}>
                          {formatDatetime(parseDate(firstOrder.dateActivated), { mode: 'standard', noToday: true })}
                        </p>
                      </div>
                    </div>
                  </div>
                  <p className={styles.testDoneHeader}>{capitalize(t('testDone', 'Test done'))}</p>
                </>
              )}

              {filteredOrders.map((order, index) => (
                <div key={order.uuid} className={styles.printableReport}>
                  <PrintableReport order={order} key={index} index={index} />
                </div>
              ))}
            </div>
          </div>
        </div>
      </ModalBody>
      <ModalFooter>
        <Button kind="secondary" onClick={closeModal}>
          {t('discard', 'Discard')}
        </Button>
        <Button type="submit" onClick={handlePrint} disabled={filteredOrders.length === 0}>
          {t('print', 'Print')}
        </Button>
      </ModalFooter>
    </>
  );
};

export default PrintResultsModal;
