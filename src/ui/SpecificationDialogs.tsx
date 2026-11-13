import { useState } from "react";
import { Layers, Paintbrush, Ruler, Home } from "lucide-react";
import { useEditor } from "../state/store";
import { length, wallPoints, type Wall } from "../core/model";
import { formatImperial, parseImperial, feet } from "../core/units";
import { FINISH_COLORS, FINISH_KINDS, type FinishKind, type WallFinishes } from "../core/materials";
import { applyWallSpecification } from "../core/specifications";
import { detectRooms, updateRoom, type RoomRegion } from "../core/rooms";
import type { EditAnchor } from "../core/wallEditing";
import { Modal } from "./Modal";
function WallDialog({wall}:{wall:Wall}) {
  const s=useEditor(), close=()=>s.set({specification:null});
  const [tab,setTab]=useState("general"), [error,setError]=useState(""), [message,setMessage]=useState("");
  const [size,setSize]=useState(formatImperial(length(...wallPoints(s.project,wall)))),
    [height,setHeight]=useState(formatImperial(wall.height)), [thickness,setThickness]=useState(formatImperial(wall.thickness));
  const [wallType,setWallType]=useState(wall.wallType||"generic"), [locked,setLocked]=useState(!!wall.locked),
    [moveMode,setMoveMode]=useState(s.moveMode), [anchor,setAnchor]=useState<EditAnchor>(s.editAnchor), [constrain,setConstrain]=useState(s.constrainEdits);
  const [finishes,setFinishes]=useState<WallFinishes>(()=>structuredClone(wall.finishes||{
    interior:{kind:"paint",color:wall.material},exterior:{kind:wall.wallType==="exterior"?"siding":"paint",color:wall.material},
  }));
  function apply(done:boolean) {
    try {
      const next=applyWallSpecification(s.project,wall.id,{length:parseImperial(size),height:parseImperial(height),thickness:parseImperial(thickness),wallType,locked,anchor,constrain,finishes});
      s.commit(next,"Update wall specification");s.set({editAnchor:anchor,constrainEdits:constrain,moveMode});
      setError("");setMessage("Wall settings applied.");if(done) close();
    } catch(e) {setMessage("");setError((e as Error).message);}
  }
  return <Modal title={`Wall Specification — Wall ${s.project.floor.walls.findIndex(w=>w.id===wall.id)+1}`} onClose={close} wide>
    <form onSubmit={e=>{e.preventDefault();apply(true);}}>
      <div className="specification-body">
        <nav className="spec-tabs" aria-label="Wall settings sections">
          <button type="button" className={tab==="general"?"active":""} aria-pressed={tab==="general"} onClick={()=>setTab("general")}><Layers size={17}/>General</button>
          <button type="button" className={tab==="materials"?"active":""} aria-pressed={tab==="materials"} onClick={()=>setTab("materials")}><Paintbrush size={17}/>Materials</button>
        </nav>
        <div className="spec-page">
          {tab==="general"?<>
            <h3>Wall type & dimensions</h3>
            <label className="field"><span>Wall type</span><select aria-label="Wall type" value={wallType} onChange={e=>setWallType(e.target.value as NonNullable<Wall["wallType"]>)}><option value="generic">Standard wall</option><option value="exterior">Exterior wall</option><option value="interior">Interior wall</option></select></label>
            <div className="field-row"><label className="field"><span>Length</span><input data-autofocus aria-label="Wall length" value={size} onChange={e=>setSize(e.target.value)}/></label><label className="field"><span>Keep fixed when resizing</span><select aria-label="Fixed endpoint" value={anchor} onChange={e=>setAnchor(e.target.value as EditAnchor)}><option value="start">Start A</option><option value="end">End B</option><option value="both">Midpoint</option></select></label></div>
            <div className="field-row"><label className="field"><span>Height</span><input aria-label="Wall height" value={height} onChange={e=>setHeight(e.target.value)}/></label><label className="field"><span>Thickness</span><input aria-label="Wall thickness" value={thickness} onChange={e=>setThickness(e.target.value)}/></label></div>
            <p className="field-hint">Enter feet, inches or fractions, for example 12′ 6″. Thickness expands equally on both sides of the wall.</p>
            <fieldset className="spec-group"><legend>Connected walls</legend>
              <label className="field"><span>Dragging the wall</span><select aria-label="Wall movement" value={moveMode} onChange={e=>setMoveMode(e.target.value as "parallel"|"free")}><option value="parallel">Move parallel to its original position</option><option value="free">Free translation</option></select></label>
              <label className="check-field"><input type="checkbox" checked={constrain} onChange={e=>setConstrain(e.target.checked)}/>Keep square corners when resizing</label>
              <label className="check-field"><input type="checkbox" checked={locked} onChange={e=>setLocked(e.target.checked)}/>Fixed wall — lock dimensions and position</label>
            </fieldset>
          </>:<>
            <h3>Surface materials</h3><p className="field-hint">Set a finish and color for each side. Colors update in the 3D model. Surface textures and construction layers are not yet modeled.</p>
            {(["interior","exterior"] as const).map(side=><fieldset key={side} className="spec-group finish-group"><legend>{side==="interior"?"Interior surface":"Exterior surface"}</legend><div className="finish-swatch" style={{background:finishes[side].color}} aria-hidden="true"/>
              <label className="field"><span>Finish</span><select aria-label={`${side} finish`} value={finishes[side].kind} onChange={e=>{const kind=e.target.value as FinishKind;setFinishes({...finishes,[side]:{kind,color:FINISH_COLORS[kind]}});}}>{FINISH_KINDS.map(kind=><option key={kind} value={kind}>{kind[0].toUpperCase()+kind.slice(1)}</option>)}</select></label>
              <label className="field"><span>Color</span><input type="color" aria-label={`${side} color`} value={finishes[side].color} onChange={e=>setFinishes({...finishes,[side]:{...finishes[side],color:e.target.value}})}/></label>
            </fieldset>)}
          </>}
        </div>
      </div>
      <div className="spec-message" aria-live="polite">{error?<span role="alert" className="form-error">{error}</span>:message||"Changes are saved when you choose Apply or OK."}</div>
      <div className="spec-actions"><button type="button" className="secondary" onClick={()=>apply(false)}>Apply</button><button type="button" className="secondary" onClick={close}>Cancel</button><button type="submit" className="primary">OK</button></div>
    </form>
  </Modal>;
}
function RoomDialog({room}:{room:RoomRegion}) {
  const s=useEditor(),close=()=>s.set({specification:null}),[tab,setTab]=useState("general");
  const [name,setName]=useState(room.settings?.name||"Room"),[roomType,setRoomType]=useState(room.settings?.roomType||"Unspecified"),
    [showLabel,setShowLabel]=useState(room.settings?.showLabel??true),[notes,setNotes]=useState(room.settings?.notes||""),[error,setError]=useState(""),[message,setMessage]=useState("");
  function apply(done:boolean) {
    try {s.commit(updateRoom(s.project,room.key,{name,roomType,showLabel,notes}),"Update room specification");setError("");setMessage("Room settings applied.");if(done) close();}
    catch(e) {setError((e as Error).message);}
  }
  return <Modal title="Room Specification" onClose={close} wide><form onSubmit={e=>{e.preventDefault();apply(true);}}>
    <div className="specification-body"><nav className="spec-tabs" aria-label="Room settings sections"><button type="button" className={tab==="general"?"active":""} aria-pressed={tab==="general"} onClick={()=>setTab("general")}><Home size={17}/>General</button><button type="button" className={tab==="dimensions"?"active":""} aria-pressed={tab==="dimensions"} onClick={()=>setTab("dimensions")}><Ruler size={17}/>Dimensions</button></nav>
      <div className="spec-page">{tab==="general"?<><h3>Room identification</h3>
        <label className="field"><span>Room name</span><input data-autofocus aria-label="Room name" value={name} maxLength={80} onChange={e=>setName(e.target.value)}/></label>
        <label className="field"><span>Room type</span><select aria-label="Room type" value={roomType} onChange={e=>setRoomType(e.target.value)}>{[...new Set(["Unspecified","Living room","Kitchen","Dining room","Bedroom","Bathroom","Office","Hall","Laundry","Garage","Closet",roomType])].map(t=><option key={t}>{t}</option>)}</select></label>
        <label className="check-field"><input type="checkbox" checked={showLabel} onChange={e=>setShowLabel(e.target.checked)}/>Show room name and area in plan</label>
        <label className="field"><span>Notes</span><textarea aria-label="Room notes" maxLength={2000} rows={3} value={notes} onChange={e=>setNotes(e.target.value)}/></label>
      </>:<><h3>Calculated room dimensions</h3><dl className="room-measurements"><dt>Interior floor area</dt><dd>{room.area.toLocaleString(undefined,{maximumFractionDigits:2})} sq ft</dd><dt>Interior perimeter</dt><dd>{formatImperial(feet(room.perimeter))}</dd><dt>Enclosing walls</dt><dd>{room.wallIds.length}</dd></dl><p className="field-hint">Calculated from the actual interior polygon, including recesses and angled walls. Resize an enclosing wall to update these measurements automatically.</p></>}</div>
    </div><div className="spec-message" aria-live="polite">{error?<span className="form-error" role="alert">{error}</span>:message||"Room settings stay with these enclosing walls."}</div><div className="spec-actions"><button type="button" className="secondary" onClick={()=>apply(false)}>Apply</button><button type="button" className="secondary" onClick={close}>Cancel</button><button type="submit" className="primary">OK</button></div>
  </form></Modal>;
}
export function SpecificationDialogs() {
  const s=useEditor(),spec=s.specification;
  if(spec?.kind==="wall") {const wall=s.project.floor.walls.find(w=>w.id===spec.id);return wall?<WallDialog key={wall.id} wall={wall}/>:null;}
  if(spec?.kind==="room") {const room=detectRooms(s.project).find(r=>r.key===spec.key);return room?<RoomDialog key={room.key} room={room}/>:null;}
  return null;
}
