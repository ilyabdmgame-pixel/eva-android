package ru.eva.envtest;

final class PetClimb {
    private static final int[] CONTACT_X={288,278,271,285,238,246,174,172,225,158,162,164};

    private PetClimb() {}

    static float handX(float clock,boolean left){
        int i=(int)PetMotion.clamp(clock,0,11),j=Math.min(11,i+1);
        float x=CONTACT_X[i]+(CONTACT_X[j]-CONTACT_X[i])*PetMotion.clamp(clock-i,0,1);
        return left?402-x:x;
    }

    static int rootForHand(int edge,int width,float frame,boolean left){
        return edge-Math.round(width*handX(frame,left)/402f);
    }

    static boolean needsLadder(int top,int windowY,int height){
        return top-windowY<Math.round(height*PetMotion.ROPE_HAND_Y);
    }

    static int climbToY(int top,int height){return PetMotion.ropeCatchY(top,height);}

    static final class Track {
        final int startX,startY,endX,endY,edge,width;
        final boolean left;
        final float first,last,seatAnchor;
        private final float startOffsetX,endOffsetX,firstContact,contactDistance;

        Track(int startX,int startY,int endX,int endY,int edge,int width,
                boolean left,float first,float last){
            this.startX=startX;this.startY=startY;this.endX=endX;this.endY=endY;
            this.edge=edge;this.width=width;
            this.left=left;this.first=first;this.last=last;
            seatAnchor=(first>last?startX:endX)+width*handX(11,left)/402f;
            startOffsetX=startX-nominalX(first);
            endOffsetX=endX-nominalX(last);
            firstContact=PetMotion.mantleContactAt(first);
            contactDistance=PetMotion.mantleContactAt(last)-firstContact;
        }

        int duration(){return Math.max(700,Math.round((Math.abs(last-first)+.6f)*PetMotion.MANTLE_FRAME_MS));}

        float clock(float t){return first+(last-first)*t;}

        PetMotion.Position position(float progress){
            float t=PetMotion.clamp(progress,0,1);
            if(t==0)return new PetMotion.Position(startX,startY);
            if(t==1)return new PetMotion.Position(endX,endY);
            float frame=clock(t);
            float start=1-PetMotion.ease(t/.38f),end=PetMotion.ease((t-.70f)/.30f);
            float heightProgress=contactDistance==0?t:(PetMotion.mantleContactAt(frame)-firstContact)/contactDistance;
            return new PetMotion.Position(Math.round(nominalX(frame)+startOffsetX*start+endOffsetX*end),
                Math.round(startY+(endY-startY)*heightProgress));
        }

        private float nominalX(float frame){
            float transfer=PetMotion.ease((frame-3)/8f);
            return edge+(seatAnchor-edge)*transfer-width*handX(frame,left)/402f;
        }
    }
}
