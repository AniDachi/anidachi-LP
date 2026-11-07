import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { beforeEach, afterEach, describe, it, expect, vi } from 'vitest';
import { useRoomClosingPresentation } from '../src/use-room-closing-presentation';
type Options = Parameters<typeof useRoomClosingPresentation>[0];
let options: Options, current: ReturnType<typeof useRoomClosingPresentation>, root: Root, host: HTMLElement;
function Harness() { current = useRoomClosingPresentation(options); return <output>{String(current.closing)}</output>; }
async function render(patch: Partial<Options> = {}) { options={...options,...patch}; await act(async()=>root.render(<Harness/>)); }
describe('room closing presentation',()=>{
 beforeEach(()=>{ (globalThis as any).IS_REACT_ACT_ENVIRONMENT=true; vi.useFakeTimers(); host=document.createElement('div');root=createRoot(host);options={loginKey:'login',roomId:'room',pending:false,ready:false,failed:false}; });
 afterEach(async()=>{await act(async()=>root.unmount());vi.useRealTimers();});
 it('keeps Closing through terminal event and HTTP completion until fresh time is ready',async()=>{
  await render();await act(async()=>current.begin()); await render({pending:true});
  await render({roomId:null,ready:true});expect(current.closing).toBe(true);
  await render({pending:false,ready:false});expect(current.closing).toBe(true);
  await render({ready:true});expect(current.closing).toBe(false);
  await render({ready:false});expect(current.closing).toBe(false);
 });
 it('ends on a final read failure and never fabricates an idle balance',async()=>{
  await render();await act(async()=>current.begin());await render({roomId:null,failed:true});expect(current.closing).toBe(false);
 });
 it.each([{loginKey:'other'},{roomId:'new-room'}])('retires on scope change %j',async change=>{
  await render();await act(async()=>current.begin());await render(change);expect(current.closing).toBe(false);
 });
 it('survives duplicate terminal notifications without extending the deadline',async()=>{
  await render();await act(async()=>current.begin());await act(async()=>vi.advanceTimersByTimeAsync(11000));
  await act(async()=>current.begin());await act(async()=>vi.advanceTimersByTimeAsync(1000));expect(current.closing).toBe(false);
 });
 it('cancels when closing failed and the live room remains',async()=>{
  await render();await act(async()=>current.begin());await act(async()=>current.cancel());expect(current.closing).toBe(false);
 });
});
