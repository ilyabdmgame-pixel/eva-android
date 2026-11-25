package ru.eva.envtest;

import java.util.ArrayList;
import java.util.List;

/** Short-lived window geometry, converted into the overlay's local coordinate system. */
final class PetWindowGround {
    private PetWindowGround(){}

    static List<PetHomeMap.Box> local(List<PetWindows.Edge> edges,int left,int top){
        List<PetHomeMap.Box> result=new ArrayList<>(edges.size());
        for(PetWindows.Edge e:edges){
            int kind=e.kind==PetWindows.IME?PetHomeMap.KEYBOARD:PetHomeMap.APP_WINDOW;
            result.add(new PetHomeMap.Box(kind,e.l-left,e.t-top,e.r-left,e.b-top,e.id));
        }
        return result;
    }

    static boolean fits(PetHomeMap.Box b,int x,int width){
        int center=x+width/2,pad=Math.round(width*.08f);
        return center-pad>=b.l&&center+pad<=b.r;
    }

    static PetHomeMap.Box covering(List<PetHomeMap.Box> boxes,int x,int y,int w,int h){
        int sole=y+Math.round(h*PetHomeMap.SOLE_CONTACT);
        for(PetHomeMap.Box b:boxes){
            if(fits(b,x,w)&&PetHomeMap.standY(b,h)>=0&&sole>=b.t&&sole<=b.b)return b;
        }
        return null;
    }

    static PetHomeMap.Box track(List<PetHomeMap.Box> previous,List<PetHomeMap.Box> boxes,
                                PetHomeMap.Box old,int x,int w){
        int parts=0;
        PetHomeMap.Box candidate=null,under=null;
        for(PetHomeMap.Box b:boxes){
            if(b.windowId!=old.windowId||b.kind!=old.kind)continue;
            parts++;
            candidate=b;
            if(fits(b,x,w)&&(under==null||Math.abs(b.t-old.t)<Math.abs(under.t-old.t)))under=b;
        }
        if(under!=null)return under;
        if(parts!=1||Math.abs((old.r-old.l)-(candidate.r-candidate.l))>2)return null;
        // A single moving dialog can carry the pet. A surviving half of a split keyboard cannot.
        for(PetHomeMap.Box b:previous)
            if(b.windowId==old.windowId&&b.kind==old.kind&&!b.same(old,0))return null;
        return fits(candidate,x+candidate.l-old.l,w)?candidate:null;
    }

    static int carryX(PetHomeMap.Box old,PetHomeMap.Box fresh,int x,int w,int maxX){
        int candidate=Math.abs((old.r-old.l)-(fresh.r-fresh.l))<=2?x+fresh.l-old.l:x;
        int pad=Math.round(w*.08f);
        return Math.max(0,Math.min(maxX,Math.max(fresh.l+pad-w/2,Math.min(fresh.r-pad-w/2,candidate))));
    }

    static int walkGoal(PetHomeMap.Box support,int x,int w,int maxX){
        int pad=Math.round(w*.26f);
        int first=Math.max(0,support.l+pad-w/2),last=Math.min(maxX,support.r-pad-w/2);
        if(last<=first)return x;
        return x-first<last-x?last:first;
    }
}
