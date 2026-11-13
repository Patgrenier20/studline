import { useEffect, useRef, type ReactNode } from "react";
import { X } from "lucide-react";
export function Modal({title,onClose,children,wide=false}:{title:string;onClose:()=>void;children:ReactNode;wide?:boolean}) {
  const ref=useRef<HTMLDivElement>(null), closeRef=useRef(onClose);
  useEffect(()=>{closeRef.current=onClose;},[onClose]);
  useEffect(()=>{
    const previous=document.activeElement as HTMLElement;
    (ref.current?.querySelector<HTMLElement>("[data-autofocus]") || ref.current?.querySelector<HTMLElement>("input,button"))?.focus();
    const key=(e:KeyboardEvent)=>{
      if(e.key==="Escape") { e.preventDefault(); e.stopPropagation(); closeRef.current(); }
      if(e.key==="Tab") {
        const list=Array.from(ref.current?.querySelectorAll<HTMLElement>('button:not(:disabled),input:not(:disabled),select:not(:disabled),textarea,[tabindex="0"]')||[]).filter(el=>el.getClientRects().length);
        const first=list[0],last=list.at(-1);
        if(e.shiftKey&&document.activeElement===first) { e.preventDefault();last?.focus(); }
        else if(!e.shiftKey&&document.activeElement===last) { e.preventDefault();first?.focus(); }
      }
    };
    window.addEventListener("keydown",key,true);
    return ()=>{window.removeEventListener("keydown",key,true);previous?.focus();};
  },[]);
  return <div className="modal-backdrop"><div ref={ref} className={`modal ${wide?"specification-modal":""}`} role="dialog" aria-modal="true" aria-label={title}>
    <div className="modal-title"><h2>{title}</h2><button type="button" aria-label="Close dialog" className="icon-button" onClick={onClose}><X size={18}/></button></div>{children}
  </div></div>;
}
