import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import dayjs from 'dayjs';
import { capitalize } from 'lodash-es';
import { useTranslation } from 'react-i18next';
import { useReactToPrint } from 'react-to-print';
import { useSWRConfig } from 'swr';
import {
  Button,
  DataTable,
  DataTableSkeleton,
  Dropdown,
  InlineLoading,
  Layer,
  OverflowMenu,
  OverflowMenuItem,
  Search,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableExpandedRow,
  TableExpandHeader,
  TableExpandRow,
  TableHead,
  TableHeader,
  TableRow,
  TableToolbarContent,
  Tag,
  Tile,
} from '@carbon/react';
import {
  CardHeader,
  EmptyState,
  ErrorState,
  getDrugOrderByUuid,
  invalidateVisitByUuid,
  PatientChartPagination,
  type FulfillerStatus,
  type Order,
  type OrderBasketItem,
  type OrderType,
  type OrderUrgency,
  useLaunchWorkspaceRequiringVisit,
  useOrderBasket,
  useOrderTypes,
  usePatientOrders,
} from '@openmrs/esm-patient-common-lib';
import { prepMedicationOrderPostData } from '@openmrs/esm-patient-medications-app/src/api/api';
import { prepTestOrderPostData } from '@openmrs/esm-patient-tests-app/src/test-orders/api';
import { prepOrderPostData } from '../order-basket/general-order-type/resources';
import {
  AddIcon,
  age,
  ExtensionSlot,
  formatDate,
  getCoreTranslation,
  getPatientName,
  launchWorkspace2,
  OpenmrsDateRangePicker,
  parseDate,
  PrinterIcon,
  useConfig,
  useLayoutType,
  usePagination,
  useSession,
  userHasAccess,
} from '@openmrs/esm-framework';
import { buildGeneralOrder, buildLabOrder, buildMedicationOrder } from '../utils';
import { useDiscontinuedOrderReasons } from '../hooks/useDiscontinuedOrderReasons';
import { useCompletedDispenseQuantities, useMedicationDispenseReasons } from '../hooks/useMedicationDispenseReasons';
import { ORDER_TYPES, getOrderGrouping, isValidOmrsOrderType } from '../constants/order-types';
import GeneralOrderTable from './general-order-table.component';
import MedicationRecord from './medication-record.component';
import PrintComponent from '../print/print.component';
import styles from './order-details-table.scss';

interface OrderDetailsProps {
  patientUuid: string;
  patient: fhir.Patient;
  showAddButton?: boolean;
  showPrintButton?: boolean;
  title?: string;
}

interface OrderBasketItemActionsProps {
  orderItem: Order;
  patient: fhir.Patient;
  /** The entry shows the dispensed part of a partly dispensed order, so it is treated as completed. */
  isCompletedPart?: boolean;
  /** A newer order already revised this one, so it can no longer be modified or cancelled. */
  isReplaced?: boolean;
  /** A completed lab order: its results filing stopped it, so it can't be revised, only have its results edited. */
  isStopped?: boolean;
}

interface OrderHeaderProps {
  key: string;
  header: string;
  isSortable: boolean;
}

function getPriorityTagType(urgency: OrderUrgency) {
  switch (urgency) {
    case 'ROUTINE':
      return 'green';
    case 'STAT':
      return 'red';
    default:
      return 'gray';
  }
}

function getStatusTagType(status: FulfillerStatus) {
  switch (status) {
    case 'RECEIVED':
      return 'blue';
    case 'IN_PROGRESS':
      return 'cyan';
    case 'ON_HOLD':
      return 'teal';
    case 'EXCEPTION':
      return 'magenta';
    case 'COMPLETED':
      return 'green';
    case 'DECLINED':
      return 'red';
    default:
      return 'gray';
  }
}

const COMPLETED_ROW_SUFFIX = '::completed';

const OrderDetailsTable: React.FC<OrderDetailsProps> = ({
  patientUuid,
  patient,
  showAddButton,
  showPrintButton,
  title,
}) => {
  const { t } = useTranslation();
  const defaultPageSize = 10;
  const headerTitle = t('orders', 'Orders');
  const isTablet = useLayoutType() === 'tablet';
  const responsiveSize = isTablet ? 'lg' : 'md';
  const _launchOrderBasket = useLaunchWorkspaceRequiringVisit(patientUuid, 'order-basket');
  const session = useSession();
  const canManageOrders = userHasAccess('Task: patientChart.addLabOrder', session?.user);
  const contentToPrintRef = useRef<HTMLDivElement | null>(null);
  const { excludePatientIdentifierCodeTypes } = useConfig();
  const discontinuedOrderReasons = useDiscontinuedOrderReasons(patientUuid);
  const medicationDispenseReasons = useMedicationDispenseReasons(patientUuid);
  const completedDispenseQuantities = useCompletedDispenseQuantities(patientUuid);
  const [isPrinting, setIsPrinting] = useState(false);
  const { data: orderTypes } = useOrderTypes();
  const [selectedOrderTypeUuid, setSelectedOrderTypeUuid] = useState(null);
  // UI-controlled date range
  const [dateRange, setDateRange] = useState<[Date | null, Date | null]>([new Date(), new Date()]);
  // Derived API filter dates (ISO strings)
  const [startDate, endDate] = dateRange;
  const selectedFromDate = useMemo(() => (startDate ? dayjs(startDate).format('YYYY-MM-DD') : null), [startDate]);
  const selectedToDate = useMemo(() => (endDate ? dayjs(endDate).format('YYYY-MM-DD') : null), [endDate]);

  const selectedOrderType = orderTypes?.find((x) => x.uuid === selectedOrderTypeUuid);

  const getOrderTypeDisplayText = useCallback(
    (orderType: OrderType | undefined) => {
      if (!orderType) {
        return t('ordersLower', 'orders');
      }

      const label = (orderType.display || orderType.name || '').toLowerCase();
      if (label.includes('test')) {
        return t('testOrders', 'test orders');
      }
      if (label.includes('drug')) {
        return t('drugOrders', 'drug orders');
      }
      return t('ordersLower', 'orders');
    },
    [t],
  );

  const emptyStateDisplayText = useMemo(() => {
    return getOrderTypeDisplayText(selectedOrderType);
  }, [selectedOrderType, getOrderTypeDisplayText]);

  const getOrderTypeLabel = useCallback(
    (orderType: OrderType) => {
      if (!orderType) {
        return '';
      }
      if (!orderType.uuid) {
        return t('allOrders', 'All orders');
      }

      const label = (orderType.display || orderType.name || '').toLowerCase();
      if (label.includes('drug')) {
        const value = t('drugOrders', 'Drug orders');
        return value ? value.charAt(0).toUpperCase() + value.slice(1) : value;
      }
      if (label.includes('test')) {
        const value = t('testOrders', 'Test orders');
        return value ? value.charAt(0).toUpperCase() + value.slice(1) : value;
      }
      return orderType.display || orderType.name || '';
    },
    [t],
  );

  const {
    data: allOrders,
    error,
    isLoading,
    isValidating,
  } = usePatientOrders(patientUuid, 'ACTIVE', selectedOrderTypeUuid, selectedFromDate, selectedToDate);

  const displayedOrders = useMemo(() => allOrders ?? [], [allOrders]);

  // An order that has been modified is stopped by the server and replaced by a new order pointing
  // back at it, so it can't be modified again: only the newest order in the chain can. The replacing
  // order is not always in the list (it may itself have been cancelled), hence the dateStopped check
  // where the menu is rendered.
  const replacedOrderUuids = useMemo(
    () =>
      new Set(
        (allOrders ?? [])
          .filter((order) => order.action === 'REVISE' && order.previousOrder?.uuid)
          .map((order) => order.previousOrder.uuid),
      ),
    [allOrders],
  );

  const launchOrderBasketForNewItem = useCallback(
    () => _launchOrderBasket(null, { encounterUuid: '' }),
    [_launchOrderBasket],
  );

  const tableHeaders: Array<OrderHeaderProps> = [
    {
      key: 'orderNumber',
      header: t('orderNumber', 'Order number'),
      isSortable: true,
    },
    {
      key: 'dateOfOrder',
      header: t('dateOfOrder', 'Date of order'),
      isSortable: true,
    },
    {
      key: 'orderType',
      header: t('orderType', 'Order type'),
      isSortable: true,
    },
    {
      key: 'order',
      header: t('order', 'Order'),
      isSortable: true,
    },
    {
      key: 'priority',
      header: t('priority', 'Priority'),
      isSortable: false,
    },
    {
      key: 'orderedBy',
      header: t('orderedBy', 'Ordered by'),
      isSortable: false,
    },
    {
      key: 'status',
      header: t('status', 'Status'),
      isSortable: false,
    },
    {
      key: 'reasonForCancelling',
      header: t('reasonForCancelling', 'Reason for Cancelling'),
      isSortable: false,
    },
  ];

  const tableRows = useMemo(
    () =>
      displayedOrders?.flatMap((order) => {
        const row = {
          id: order.uuid,
          dateActivated: order.dateActivated,
          orderNumber: order.orderNumber,
          dateOfOrder: <div className={styles.singleLineText}>{formatDate(parseDate(order.dateActivated))}</div>,
          orderType: capitalize(order.orderType?.display ?? '-'),
          order: order.display,
          priority: (
            <Tag type={getPriorityTagType(order.urgency)}>
              {
                // t('ON_SCHEDULED_DATE', 'On scheduled date')
                // t('ROUTINE', 'Routine')
                // t('STAT', 'STAT')
              }
              {t(order.urgency, capitalize(order.urgency.replaceAll('_', ' ')))}
            </Tag>
          ),
          orderedBy: order.orderer?.display,
          // A new order nobody has acted on yet has no fulfiller status: it is in progress.
          status: (
            <Tag
              className={order.fulfillerStatus === 'DECLINED' ? styles.declinedTag : undefined}
              type={getStatusTagType(order.fulfillerStatus ?? 'IN_PROGRESS')}
            >
              {
                // t('COMPLETED', 'Completed')
                // t('DECLINED', 'Declined')
                // t('DISCONTINUED', 'Discontinued')
                // t('EXCEPTION', 'Exception')
                // t('IN_PROGRESS', 'In progress')
                // t('ON_HOLD', 'On hold')
                // t('RECEIVED', 'Received')
              }
              {t(
                order.fulfillerStatus ?? 'IN_PROGRESS',
                capitalize((order.fulfillerStatus ?? 'IN_PROGRESS').replaceAll('_', ' ')),
              )}
            </Tag>
          ),
          reasonForCancelling:
            order.fulfillerComment ||
            discontinuedOrderReasons[order.uuid] ||
            medicationDispenseReasons[order.uuid] ||
            '--',
        };

        // Part of it was dispensed but the order is still open: show it as in progress, with how much
        // has been dispensed so far, instead of an empty status.
        const dispensedSoFar = completedDispenseQuantities[order.uuid];
        const isOpen = !order.fulfillerStatus || ['RECEIVED', 'IN_PROGRESS'].includes(order.fulfillerStatus);
        if (
          isOpen &&
          dispensedSoFar &&
          (dispensedSoFar.ordered == null || dispensedSoFar.quantity < dispensedSoFar.ordered)
        ) {
          const { quantity, ordered, unit } = dispensedSoFar;
          const dispensedLabel = unit ? `${quantity} ${unit}` : quantity;
          return [
            {
              ...row,
              status: (
                <Tag type={getStatusTagType('IN_PROGRESS')}>
                  {ordered != null
                    ? t('inProgressQuantity', 'In progress ({{dispensed}} of {{total}})', {
                        dispensed: quantity,
                        total: unit ? `${ordered} ${unit}` : ordered,
                      })
                    : t('inProgressDispensed', 'In progress ({{dispensed}} dispensed)', { dispensed: dispensedLabel })}
                </Tag>
              ),
            },
          ];
        }

        // Closed or put on hold after part of it was dispensed: show the dispensed part as its own
        // completed entry, so completed and declined/on-hold quantities are clearly separated.
        const isClosedOrOnHold = order.fulfillerStatus === 'DECLINED' || order.fulfillerStatus === 'ON_HOLD';
        if (!isClosedOrOnHold || !completedDispenseQuantities[order.uuid]) {
          return [row];
        }
        const { quantity, unit, ordered } = completedDispenseQuantities[order.uuid];
        const formatQuantity = (value: number) => (unit ? `${value} ${unit}` : value);
        const remaining = ordered != null ? ordered - quantity : 0;
        const completedRow = {
          ...row,
          id: `${order.uuid}${COMPLETED_ROW_SUFFIX}`,
          status: (
            <Tag type={getStatusTagType('COMPLETED')}>
              {t('completedQuantity', 'Completed ({{quantity}})', {
                quantity: formatQuantity(quantity),
              })}
            </Tag>
          ),
          reasonForCancelling: '--',
        };
        // Same label as the completed entry, with the part that was not dispensed.
        const remainingRow =
          remaining > 0
            ? {
                ...row,
                status: (
                  <Tag
                    className={order.fulfillerStatus === 'DECLINED' ? styles.declinedTag : undefined}
                    type={getStatusTagType(order.fulfillerStatus)}
                  >
                    {t(order.fulfillerStatus, capitalize(order.fulfillerStatus.replaceAll('_', ' ')))}
                    {` (${formatQuantity(remaining)})`}
                  </Tag>
                ),
              }
            : row;
        return [completedRow, remainingRow];
      }) ?? [],
    [displayedOrders, t, discontinuedOrderReasons, medicationDispenseReasons, completedDispenseQuantities],
  );

  const { results: paginatedOrders, goTo, currentPage } = usePagination(tableRows, defaultPageSize);

  const patientDetails = useMemo(() => {
    const getGender = (gender: string): string => {
      switch (gender) {
        case 'male':
          return getCoreTranslation('male');
        case 'female':
          return getCoreTranslation('female');
        case 'other':
          return getCoreTranslation('other');
        case 'unknown':
          return getCoreTranslation('unknown');
        default:
          return gender;
      }
    };

    const identifiers =
      patient?.identifier?.filter(
        (identifier) => !excludePatientIdentifierCodeTypes?.uuids?.includes(identifier.type.coding[0].code),
      ) ?? [];

    return {
      name: patient ? getPatientName(patient) : '',
      age: age(patient?.birthDate),
      gender: getGender(patient?.gender),
      location: patient?.address?.[0].city,
      identifiers: identifiers?.length ? identifiers.map(({ value }) => value) : [],
    };
  }, [patient, excludePatientIdentifierCodeTypes?.uuids]);

  const onBeforeGetContentResolve = useRef<null | ((value?: unknown) => void)>(null);

  useEffect(() => {
    if (isPrinting && onBeforeGetContentResolve.current) {
      onBeforeGetContentResolve.current();
    }
  }, [isPrinting]);

  const handlePrint = useReactToPrint({
    content: () => contentToPrintRef.current,
    documentTitle: `OpenMRS - ${patientDetails.name} - ${title}`,
    onBeforeGetContent: () =>
      new Promise((resolve) => {
        if (patient && title) {
          onBeforeGetContentResolve.current = resolve;
          setIsPrinting(true);
        }
      }),
    onAfterPrint: () => {
      onBeforeGetContentResolve.current = null;
      setIsPrinting(false);
    },
  });

  const orderTypesToDisplay = useMemo(
    () => [
      {
        display: t('allOrders', 'All orders'),
        uuid: null,
      },
      ...(orderTypes?.map((orderType) => ({
        display: orderType.display,
        uuid: orderType.uuid,
      })) ?? []),
    ],
    [orderTypes, t],
  );

  const handleDateFilterChange = useCallback(
    ([startDate, endDate]: [Date | null | undefined, Date | null | undefined]) => {
      setDateRange([startDate ?? null, endDate ?? null]);
    },
    [],
  );

  const isOmrsOrder = useCallback((orderItem: Order) => isValidOmrsOrderType(orderItem.type), []);

  return (
    <>
      <div className={styles.filterContainer}>
        <div className={styles.dropdownContainer}>
          <Dropdown
            id="orderTypeDropdown"
            items={orderTypesToDisplay}
            itemToString={(orderType: OrderType) => getOrderTypeLabel(orderType)}
            label={t('allOrders', 'All orders')}
            onChange={(e: { selectedItem: OrderType }) => {
              const selected = e.selectedItem;
              setSelectedOrderTypeUuid(selected?.uuid ?? null);
            }}
            selectedItem={orderTypesToDisplay.find((x) => x.uuid === selectedOrderTypeUuid)}
            titleText={t('selectOrderType', 'Select order type') + ':'}
            type="inline"
          />
        </div>
        <OpenmrsDateRangePicker
          className={styles.inlineDateRange}
          labelText={t('dateRange', 'Date range') + ':'}
          maxDate={new Date()}
          onChange={handleDateFilterChange}
          value={dateRange}
        />
      </div>

      {isLoading ? (
        <DataTableSkeleton role="progressbar" compact={!isTablet} zebra />
      ) : error ? (
        <ErrorState error={error} headerTitle={title} />
      ) : orderTypes?.length > 0 ? (
        <>
          {!tableRows?.length ? (
            <EmptyState
              headerTitle={headerTitle}
              displayText={emptyStateDisplayText}
              launchForm={canManageOrders ? () => launchOrderBasketForNewItem() : undefined}
            />
          ) : (
            <div className={styles.widgetCard}>
              <CardHeader title={title}>
                {isValidating ? (
                  <span>
                    <InlineLoading />
                  </span>
                ) : null}
                <div className={styles.buttons}>
                  {showPrintButton && (
                    <Button
                      className={styles.printButton}
                      iconDescription={t('printOrder', 'Print order')}
                      kind="ghost"
                      onClick={handlePrint}
                      renderIcon={PrinterIcon}
                    >
                      {t('print', 'Print')}
                    </Button>
                  )}
                  {showAddButton && canManageOrders && (
                    <Button
                      className={styles.addButton}
                      kind="ghost"
                      renderIcon={AddIcon}
                      iconDescription={t('launchOrderBasket', 'Launch order basket')}
                      onClick={() => launchOrderBasketForNewItem()}
                    >
                      {t('add', 'Add')}
                    </Button>
                  )}
                </div>
              </CardHeader>
              <div ref={contentToPrintRef}>
                <PrintComponent subheader={title} patientDetails={patientDetails} />
                <DataTable
                  aria-label={t('orderDetails', 'Order details')}
                  data-floating-menu-container
                  headers={tableHeaders}
                  isSortable
                  overflowMenuOnHover={!isTablet}
                  rows={paginatedOrders}
                  size={responsiveSize}
                  useZebraStyles
                >
                  {({
                    getExpandedRowProps,
                    getExpandHeaderProps,
                    getHeaderProps,
                    getRowProps,
                    getTableContainerProps,
                    getTableProps,
                    headers,
                    onInputChange,
                    rows,
                  }) => (
                    <>
                      <TableContainer {...getTableContainerProps()}>
                        {!isPrinting && (
                          <div className={styles.toolBarContent}>
                            <TableToolbarContent>
                              <Search
                                isExpanded
                                labelText={t('searchTable', 'Search table')}
                                onChange={(e: React.ChangeEvent<HTMLInputElement>) => onInputChange(e)}
                                placeholder={t('searchTable', 'Search table')}
                              />
                            </TableToolbarContent>
                          </div>
                        )}
                        <Table className={styles.table} {...getTableProps()}>
                          <TableHead>
                            <TableRow>
                              <TableExpandHeader enableToggle {...getExpandHeaderProps()} />
                              {headers.map((header) => (
                                <TableHeader
                                  {...getHeaderProps({ header })}
                                  isSortable={(header as unknown as OrderHeaderProps).isSortable}
                                >
                                  {header.header}
                                </TableHeader>
                              ))}
                              {!isPrinting && <TableExpandHeader />}
                            </TableRow>
                          </TableHead>
                          <TableBody>
                            {rows.map((row) => {
                              const isCompletedPartRow = row.id.endsWith(COMPLETED_ROW_SUFFIX);
                              const matchingOrder = allOrders?.find(
                                (order) => order.uuid === row.id.replace(COMPLETED_ROW_SUFFIX, ''),
                              );
                              const isExpandable =
                                matchingOrder?.type === ORDER_TYPES.DRUG_ORDER ||
                                matchingOrder?.type === ORDER_TYPES.GENERAL_ORDER;

                              const cells = row.cells.map((cell) => (
                                <TableCell className={styles.tableCell} key={cell.id}>
                                  {cell.value?.['content'] ?? cell.value}
                                </TableCell>
                              ));

                              const actionCell = !isPrinting && (
                                <TableCell className="cds--table-column-menu">
                                  {matchingOrder && isOmrsOrder(matchingOrder) ? (
                                    <OrderBasketItemActions
                                      patient={patient}
                                      orderItem={matchingOrder}
                                      isCompletedPart={isCompletedPartRow}
                                      isStopped={
                                        matchingOrder.type === ORDER_TYPES.TEST_ORDER &&
                                        (matchingOrder.fulfillerStatus === 'COMPLETED' || !!matchingOrder.dateStopped)
                                      }
                                      isReplaced={
                                        replacedOrderUuids.has(matchingOrder.uuid) ||
                                        // Revising or cancelling a drug/general order stops it on the server;
                                        // dispensing statuses (completed, declined, on hold) do not.
                                        (!!matchingOrder.dateStopped && matchingOrder.type !== ORDER_TYPES.TEST_ORDER)
                                      }
                                    />
                                  ) : (
                                    <ExtensionSlot
                                      name={`${matchingOrder?.type}-action-menu-items-slot`}
                                      state={{
                                        className: styles.menuItem,
                                        orderItem: matchingOrder,
                                        responsiveSize,
                                      }}
                                    />
                                  )}
                                </TableCell>
                              );

                              return (
                                <React.Fragment key={row.id}>
                                  {isExpandable ? (
                                    <TableExpandRow className={styles.row} {...getRowProps({ row })}>
                                      {cells}
                                      {actionCell}
                                    </TableExpandRow>
                                  ) : (
                                    <TableRow className={styles.row} {...getRowProps({ row })}>
                                      <TableCell />
                                      {cells}
                                      {actionCell}
                                    </TableRow>
                                  )}
                                  {isExpandable &&
                                    (row.isExpanded ? (
                                      <TableExpandedRow
                                        colSpan={headers.length + 2}
                                        {...getExpandedRowProps({
                                          row,
                                        })}
                                      >
                                        {matchingOrder?.type === ORDER_TYPES.DRUG_ORDER ? (
                                          <MedicationRecord medication={matchingOrder} />
                                        ) : (
                                          <GeneralOrderTable order={matchingOrder} />
                                        )}
                                      </TableExpandedRow>
                                    ) : (
                                      <TableExpandedRow className={styles.hiddenRow} colSpan={headers.length + 2} />
                                    ))}
                                </React.Fragment>
                              );
                            })}
                          </TableBody>
                        </Table>
                      </TableContainer>
                      {rows.length === 0 ? (
                        <div className={styles.tileContainer}>
                          <Tile className={styles.emptyStateTile}>
                            <div className={styles.tileContent}>
                              <p className={styles.content}>
                                {t('noMatchingOrdersToDisplay', 'No matching orders to display')}
                              </p>
                              <p className={styles.helperText}>{t('checkFilters', 'Check the filters above')}</p>
                            </div>
                          </Tile>
                        </div>
                      ) : null}
                    </>
                  )}
                </DataTable>
                {!isPrinting && (
                  <div className={styles.paginationContainer}>
                    <PatientChartPagination
                      pageNumber={currentPage}
                      totalItems={tableRows.length}
                      currentItems={paginatedOrders.length}
                      pageSize={defaultPageSize}
                      onPageNumberChange={({ page }) => goTo(page)}
                    />
                  </div>
                )}
              </div>
            </div>
          )}
        </>
      ) : null}
    </>
  );
};

function OrderBasketItemActions({
  orderItem,
  patient,
  isCompletedPart,
  isReplaced,
  isStopped,
}: OrderBasketItemActionsProps) {
  const { t } = useTranslation();
  const isDeclined = orderItem.fulfillerStatus === 'DECLINED';
  // A completed order (a dispensed drug order, or a test order with results) can no longer be cancelled
  const isCompletedOrder =
    (orderItem.type === ORDER_TYPES.DRUG_ORDER || orderItem.type === ORDER_TYPES.TEST_ORDER) &&
    (orderItem.fulfillerStatus === 'COMPLETED' || isCompletedPart);
  const session = useSession();
  const canAddLabResults = userHasAccess('Task: laboratory.addLabResults', session?.user);
  const canManageOrders =
    orderItem.type === ORDER_TYPES.DRUG_ORDER
      ? userHasAccess('Task: patientChart.addDrugOrder', session?.user)
      : orderItem.type === ORDER_TYPES.TEST_ORDER
        ? userHasAccess('Task: patientChart.addLabOrder', session?.user)
        : userHasAccess('Task: patientChart.addDrugOrder', session?.user) ||
          userHasAccess('Task: patientChart.addLabOrder', session?.user);

  const { grouping, postDataPrepFn } = useMemo(() => {
    if (orderItem.type === ORDER_TYPES.DRUG_ORDER) {
      return {
        grouping: getOrderGrouping(ORDER_TYPES.DRUG_ORDER),
        postDataPrepFn: prepMedicationOrderPostData,
      };
    } else if (orderItem.type === ORDER_TYPES.TEST_ORDER) {
      return {
        grouping: getOrderGrouping(ORDER_TYPES.TEST_ORDER, orderItem.orderType.uuid),
        postDataPrepFn: prepTestOrderPostData,
      };
    } else {
      return {
        grouping: getOrderGrouping(ORDER_TYPES.GENERAL_ORDER, orderItem.orderType.uuid),
        postDataPrepFn: prepOrderPostData,
      };
    }
  }, [orderItem.type, orderItem.orderType.uuid]);
  const { orders, setOrders } = useOrderBasket<OrderBasketItem>(patient, grouping, postDataPrepFn);
  const alreadyInBasket = orders.some((x) => x.uuid === orderItem.uuid);
  const { mutate: globalMutate } = useSWRConfig();

  const windowProps = useMemo(() => ({ encounterUuid: orderItem.encounter?.uuid }), [orderItem.encounter?.uuid]);
  const groupProps = useMemo(
    () => ({
      patient,
      patientUuid: patient.id,
      visitContext: orderItem.encounter?.visit,
      mutateVisitContext: invalidateVisitByUuid(globalMutate, orderItem.encounter?.visit?.uuid),
    }),
    [patient, orderItem.encounter?.visit, globalMutate],
  );

  const handleCancelOrder = useCallback(() => {
    const reasonForCancelling = window.prompt(t('reasonForCancellingPrompt', 'Reason for cancelling this order:'));
    if (reasonForCancelling === null) {
      return;
    }
    if (orderItem.type === ORDER_TYPES.DRUG_ORDER) {
      getDrugOrderByUuid(orderItem.uuid)
        .then((res) => {
          const medicationOrder = res.data;
          const discontinueItem = buildMedicationOrder(medicationOrder, 'DISCONTINUE', reasonForCancelling);
          setOrders([...orders, discontinueItem]);
          launchWorkspace2('order-basket', {}, windowProps, groupProps);
        })
        .catch((e) => {
          console.error('Error cancelling drug order: ', e);
        });
    } else if (orderItem.type === ORDER_TYPES.TEST_ORDER) {
      const labItem = buildLabOrder(orderItem, 'DISCONTINUE', reasonForCancelling);
      setOrders([...orders, labItem]);
      launchWorkspace2('order-basket', {}, windowProps, groupProps);
    } else {
      const order = buildGeneralOrder(orderItem, 'DISCONTINUE', reasonForCancelling);
      setOrders([...orders, order]);
      launchWorkspace2('order-basket', {}, windowProps, groupProps);
    }
  }, [orderItem, setOrders, orders, windowProps, groupProps, t]);

  const handleModifyOrder = useCallback(() => {
    if (orderItem.type === ORDER_TYPES.DRUG_ORDER) {
      // make another call to fetch the order,
      // this time with custom rep to include the drug field
      // (when we fetch the array containing orderItem, we fetched for
      // all order types and including the drug field in the custom rep will
      // yield an error)
      getDrugOrderByUuid(orderItem.uuid)
        .then((res) => {
          const medicationOrder = res.data;
          launchWorkspace2(
            'add-drug-order',
            { order: buildMedicationOrder(medicationOrder, 'REVISE'), orderToEditOrdererUuid: orderItem.orderer.uuid },
            windowProps,
            groupProps,
          );
        })
        .catch((e) => {
          console.error('Error modifying drug order: ', e);
        });
    } else if (orderItem.type === ORDER_TYPES.TEST_ORDER) {
      const labItem = buildLabOrder(orderItem, 'REVISE');
      launchWorkspace2(
        'add-lab-order',
        { order: labItem, orderTypeUuid: orderItem.orderType.uuid, orderToEditOrdererUuid: orderItem.orderer.uuid },
        windowProps,
        groupProps,
      );
    } else if (orderItem.type === ORDER_TYPES.GENERAL_ORDER) {
      const generalItem = buildGeneralOrder(orderItem, 'REVISE');
      launchWorkspace2(
        'orderable-concept-workspace',
        { order: generalItem, orderTypeUuid: orderItem.orderType.uuid, orderToEditOrdererUuid: orderItem.orderer.uuid },
        windowProps,
        groupProps,
      );
    }
  }, [orderItem, windowProps, groupProps]);

  const handleAddOrEditTestResults = useCallback(() => {
    launchWorkspace2('test-results-form-workspace', { order: orderItem, patient });
  }, [orderItem, patient]);

  const canModify = !isStopped;
  const hasResultsAction = orderItem?.type === ORDER_TYPES.TEST_ORDER && canAddLabResults;
  const hasCancelAction = !isCompletedOrder && !isDeclined;
  if (!canManageOrders || isReplaced || (!canModify && !hasResultsAction && !hasCancelAction)) {
    return null;
  }

  return (
    <Layer className={styles.layer}>
      <OverflowMenu aria-label={t('actionsMenu', 'Actions menu')} align="left" flipped selectorPrimaryFocus="#modify">
        {canModify && (
          <OverflowMenuItem
            className={styles.menuItem}
            disabled={alreadyInBasket}
            id="modify"
            itemText={t('modifyOrder', 'Modify order')}
            onClick={handleModifyOrder}
          />
        )}
        {hasResultsAction && (
          <OverflowMenuItem
            className={styles.menuItem}
            disabled={alreadyInBasket}
            id="reorder"
            itemText={
              orderItem.fulfillerStatus === 'COMPLETED'
                ? t('editResults', 'Edit results')
                : t('addResults', 'Add results')
            }
            onClick={handleAddOrEditTestResults}
          />
        )}
        {/* A declined order can be reordered (modify), but there is nothing left to cancel */}
        {hasCancelAction && (
          <OverflowMenuItem
            className={styles.menuItem}
            disabled={alreadyInBasket || orderItem?.action === 'DISCONTINUE'}
            hasDivider
            id="discontinue"
            isDelete
            itemText={t('cancelOrder', 'Cancel order')}
            onClick={handleCancelOrder}
          />
        )}
      </OverflowMenu>
    </Layer>
  );
}

export default OrderDetailsTable;
