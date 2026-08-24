import { useEffect, useMemo, useState } from 'react';
import { collection, getDocs, orderBy, query } from 'firebase/firestore';
import { createColumnHelper, flexRender, getCoreRowModel, useReactTable } from '@tanstack/react-table';
import { db } from '../firebase';
import { formatTimestamp } from '../lib/format';
import SupportTicketModal from '../components/SupportTicketModal';
import type { SupportTicket, TicketStatus } from '../lib/types';

const columnHelper = createColumnHelper<SupportTicket>();

const STATUS_FILTERS: { key: 'all' | TicketStatus; label: string }[] = [
  { key: 'all', label: 'All' },
  { key: 'open', label: 'Open' },
  { key: 'in_progress', label: 'In Progress' },
  { key: 'resolved', label: 'Resolved' },
];

const STATUS_LABELS: Record<TicketStatus, string> = {
  open: 'Open',
  in_progress: 'In Progress',
  resolved: 'Resolved',
};

export default function SupportTickets() {
  const [tickets, setTickets] = useState<SupportTicket[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<'all' | TicketStatus>('all');
  const [selectedTicket, setSelectedTicket] = useState<SupportTicket | null>(null);

  useEffect(() => {
    load();
  }, []);

  async function load() {
    const snap = await getDocs(query(collection(db, 'supportTickets'), orderBy('updatedAt', 'desc')));
    setTickets(snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<SupportTicket, 'id'>) })));
    setLoading(false);
  }

  function handleStatusChange(ticketId: string, status: TicketStatus) {
    setTickets((prev) => prev.map((t) => (t.id === ticketId ? { ...t, status } : t)));
    setSelectedTicket((prev) => (prev && prev.id === ticketId ? { ...prev, status } : prev));
  }

  const filtered = useMemo(
    () => (statusFilter === 'all' ? tickets : tickets.filter((t) => t.status === statusFilter)),
    [tickets, statusFilter],
  );

  const columns = useMemo(
    () => [
      columnHelper.accessor('subject', { header: 'Subject' }),
      columnHelper.accessor('userName', {
        header: 'User',
        cell: (info) => (
          <>
            {info.getValue()} <span className={`type-pill type-${info.row.original.userType}`}>{info.row.original.userType}</span>
          </>
        ),
      }),
      columnHelper.accessor('status', {
        header: 'Status',
        cell: (info) => (
          <span className={`status-badge ticket-status-${info.getValue()}`}>{STATUS_LABELS[info.getValue()]}</span>
        ),
      }),
      columnHelper.accessor('updatedAt', {
        header: 'Last Update',
        cell: (info) => formatTimestamp(info.getValue()),
      }),
    ],
    [],
  );

  const table = useReactTable({
    data: filtered,
    columns,
    getCoreRowModel: getCoreRowModel(),
  });

  if (loading) {
    return <div className="page-loading">Loading support tickets…</div>;
  }

  return (
    <div className="page">
      <div className="page-header-row">
        <h1 className="page-title">Support Tickets</h1>
        <span className="count-badge">
          {filtered.length} of {tickets.length}
        </span>
      </div>

      <div className="filter-row">
        {STATUS_FILTERS.map((f) => (
          <button
            key={f.key}
            type="button"
            className={`filter-chip${statusFilter === f.key ? ' active' : ''}`}
            onClick={() => setStatusFilter(f.key)}
          >
            {f.label}
          </button>
        ))}
      </div>

      <div className="table-card">
        <table>
          <thead>
            {table.getHeaderGroups().map((headerGroup) => (
              <tr key={headerGroup.id}>
                {headerGroup.headers.map((header) => (
                  <th key={header.id}>{flexRender(header.column.columnDef.header, header.getContext())}</th>
                ))}
              </tr>
            ))}
          </thead>
          <tbody>
            {table.getRowModel().rows.map((row) => (
              <tr key={row.id} className="clickable-row" onClick={() => setSelectedTicket(row.original)}>
                {row.getVisibleCells().map((cell) => (
                  <td key={cell.id}>{flexRender(cell.column.columnDef.cell, cell.getContext())}</td>
                ))}
              </tr>
            ))}
            {filtered.length === 0 && (
              <tr>
                <td colSpan={columns.length} className="empty-row">
                  No support tickets found
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {selectedTicket && (
        <SupportTicketModal
          ticket={selectedTicket}
          onClose={() => setSelectedTicket(null)}
          onStatusChange={handleStatusChange}
        />
      )}
    </div>
  );
}
