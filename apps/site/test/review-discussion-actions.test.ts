import { beforeEach, expect, it, vi } from 'vitest';
const mocks=vi.hoisted(()=>({session:vi.fn(),blocked:vi.fn(),vote:vi.fn(),comment:vi.fn(),remove:vi.fn(),stats:vi.fn(),read:vi.fn()}));
vi.mock('next/headers',()=>({headers:async()=>new Headers()}));
vi.mock('next/cache',()=>({revalidatePath:vi.fn()}));
vi.mock('../src/lib/auth',()=>({auth:{api:{getSession:mocks.session}}}));
vi.mock('../src/lib/moderation',()=>({isUserBlocked:mocks.blocked}));
vi.mock('../src/lib/review-discussions',async importOriginal=>({...await importOriginal<typeof import('../src/lib/review-discussions')>(),setReviewReaction:mocks.vote,addReviewComment:mocks.comment,deleteReviewComment:mocks.remove,getReviewInteractions:mocks.stats,getReviewComments:mocks.read}));
import { reviewDiscussionAction } from '../src/app/catalog/discussion-actions';
const id='aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
beforeEach(()=>{vi.clearAllMocks();mocks.session.mockResolvedValue({user:{id:'viewer'}});mocks.blocked.mockResolvedValue(false);mocks.stats.mockResolvedValue(new Map([[id,{likes:1,dislikes:0,comments:0,vote:1,authenticated:true}]]));mocks.read.mockResolvedValue({items:[],hasMore:false});});
it('requires authentication for mutations but allows public reads',async()=>{
 mocks.session.mockResolvedValue(null);
 for(const action of ['vote','comment','delete'] as const)expect(await reviewDiscussionAction(id,action,1)).toMatchObject({signIn:true});
 expect(mocks.vote).not.toHaveBeenCalled();expect(mocks.comment).not.toHaveBeenCalled();expect(mocks.remove).not.toHaveBeenCalled();
 expect((await reviewDiscussionAction(id,'read')).thread).toEqual({items:[],hasMore:false});
});
it('uses the authenticated identity and checks blocks before writing',async()=>{
 await reviewDiscussionAction(id,'vote',1);expect(mocks.vote).toHaveBeenCalledWith('viewer',id,1);
 mocks.blocked.mockResolvedValue(true);await reviewDiscussionAction(id,'comment','text');expect(mocks.comment).not.toHaveBeenCalled();
});
it('rejects invalid identifiers and malformed payloads without mutations',async()=>{
 expect((await reviewDiscussionAction('invalid','vote',1)).error).toBeTruthy();
 expect((await reviewDiscussionAction(id,'comment',12)).error).toBeTruthy();
 expect(mocks.vote).not.toHaveBeenCalled();expect(mocks.comment).not.toHaveBeenCalled();
});
