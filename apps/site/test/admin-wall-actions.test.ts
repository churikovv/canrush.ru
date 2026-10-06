import { beforeEach, expect, it, vi } from 'vitest';
const mocks = vi.hoisted(() => ({ requireAdmin: vi.fn(), query: vi.fn(), release: vi.fn(), connect: vi.fn() }));
vi.mock('../src/lib/admin', () => ({ requireSiteAdmin: mocks.requireAdmin }));
vi.mock('../src/db/pool', () => ({ getPool: () => ({ connect: mocks.connect }) }));
vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }));
vi.mock('next/navigation', () => ({ redirect: (url: string) => { throw new Error(url); } }));
import { deleteAdminWallAction, deleteAdminCommentAction } from '../src/app/admin/actions';
const id = 'f26e8bac-fc04-41d2-a9bd-737bc9c0c75e';
const form = () => { const data = new FormData(); data.set('commentId',id); data.set('tab','wall'); data.set('query','test'); data.set('page','2'); return data; };
beforeEach(() => { vi.clearAllMocks(); mocks.requireAdmin.mockResolvedValue({ userId: 'admin',email:'admin@example.com' }); mocks.connect.mockResolvedValue({ query:mocks.query,release:mocks.release }); mocks.query.mockImplementation(async (sql: string) => ({ rows: sql.startsWith('delete') ? [{ id }] : [] })); });
it('requires an administrator before touching the database', async () => {
  mocks.requireAdmin.mockRejectedValue(new Error('not-admin'));
  await expect(deleteAdminWallAction(form())).rejects.toThrow('not-admin');
  expect(mocks.connect).not.toHaveBeenCalled();
});
it('deletes and audits in one transaction, then returns to the same tab and page', async () => {
  await expect(deleteAdminWallAction(form())).rejects.toThrow('/admin?notice=wall-deleted&q=test&tab=wall&page=2');
  expect(mocks.query).toHaveBeenCalledWith('begin');
  expect(mocks.query).toHaveBeenCalledWith(expect.stringContaining('adminAuditLog'), ['admin@example.com','delete','wall-comment',id]);
  expect(mocks.query).toHaveBeenCalledWith('commit'); expect(mocks.release).toHaveBeenCalled();
});
it('rolls back deletion if the audit cannot be saved', async () => {
  mocks.query.mockImplementation(async (sql: string) => { if(sql.includes('adminAuditLog')) throw new Error('database error'); return { rows: [{ id }] }; });
  await expect(deleteAdminWallAction(form())).rejects.toThrow('operation-failed');
  expect(mocks.query).toHaveBeenCalledWith('rollback'); expect(mocks.query).not.toHaveBeenCalledWith('commit');
});

it('moderates review comments with an audit entry and preserves the comments tab', async () => {
  const data=form(); data.set('tab','comments');
  await expect(deleteAdminCommentAction(data)).rejects.toThrow('/admin?notice=comment-deleted&q=test&tab=comments&page=2');
  expect(mocks.query).toHaveBeenCalledWith(expect.stringContaining('adminAuditLog'), ['admin@example.com','delete','review-comment',id]);
});
it('guards review comment moderation before accessing the database', async () => {
  mocks.requireAdmin.mockRejectedValue(new Error('not-admin'));
  await expect(deleteAdminCommentAction(form())).rejects.toThrow('not-admin');
  expect(mocks.connect).not.toHaveBeenCalled();
});

it('protects report moderation and records its audit transaction', async () => {
  const { reviewProfileReportAction } = await import('../src/app/admin/actions');
  const data = form(); data.set('reportId', id); data.set('status','resolved'); data.set('tab','reports');
  mocks.requireAdmin.mockRejectedValueOnce(new Error('not-admin'));
  await expect(reviewProfileReportAction(data)).rejects.toThrow('not-admin');
  expect(mocks.connect).not.toHaveBeenCalled();
  mocks.query.mockImplementation(async (sql: string) => ({ rows: sql.startsWith('update') ? [{ id }] : [] }));
  await expect(reviewProfileReportAction(data)).rejects.toThrow('notice=report-reviewed');
  expect(mocks.query).toHaveBeenCalledWith(expect.stringContaining('adminAuditLog'), ['admin@example.com','resolved','profile-report',id]);
  expect(mocks.query).toHaveBeenCalledWith('commit');
});
