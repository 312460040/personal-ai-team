export type IdeaNodeStatus = 'idea' | 'planned' | 'in_progress' | 'completed' | 'archived';
export type IdeaNodeKind = 'idea' | 'goal' | 'task' | 'milestone' | 'project';
export interface IdeaNode { id:string; boardId:string; title:string; note?:string; x:number; y:number; kind:IdeaNodeKind; status:IdeaNodeStatus; color?:string; linkedTaskIds:string[]; linkedNodeIds:string[]; createdAt:string; updatedAt:string; archivedAt?:string; lastReviewedAt?:string; }
export interface IdeaEdge { id:string; boardId:string; fromNodeId:string; toNodeId:string; label?:string; }
export interface IdeaBoardData { id:string; name:string; description?:string; nodes:IdeaNode[]; edges:IdeaEdge[]; createdAt:string; updatedAt:string; lastManagerReviewAt?:string; }
export const createIdeaNode=(boardId:string,title:string,x:number,y:number):IdeaNode=>{const now=new Date().toISOString();return{id:`idea-${Date.now()}-${Math.random().toString(36).slice(2,8)}`,boardId,title:title.trim()||'新想法',x,y,kind:'idea',status:'idea',linkedTaskIds:[],linkedNodeIds:[],createdAt:now,updatedAt:now}};
export const createIdeaEdge=(boardId:string,fromNodeId:string,toNodeId:string):IdeaEdge=>({id:`edge-${Date.now()}-${Math.random().toString(36).slice(2,8)}`,boardId,fromNodeId,toNodeId});
