package ru.eva.envtest;

import java.util.List;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

/** HONOR's workspace identifies the visible page, e.g. "Экран 2 из 3". */
final class PetLearnedEdges {
    private static final Pattern PAGE=Pattern.compile("(?:^|\\D)(\\d{1,3})\\s*(?:из|of|/|von|sur|de)\\s*\\d{1,3}(?:\\D|$)",Pattern.CASE_INSENSITIVE);
    static int page(CharSequence description){
        if(description==null)return -1;
        Matcher match=PAGE.matcher(description);
        if(!match.find())return -1;
        int value=Integer.parseInt(match.group(1));
        return value>0?value:-1;
    }

    static String key(int rotation,int page){
        return page<1?null:"manual_v1_r"+rotation+"_p"+page;
    }

    static PetHomeMap.Box stroke(float startX,float startY,float endX,float endY,int width,int height,
            int minWidth,int thickness){
        int left=Math.max(0,Math.round(Math.min(startX,endX)));
        int right=Math.min(width,Math.round(Math.max(startX,endX)));
        if(right-left<minWidth||Math.abs(startY-endY)>(right-left)*.45f)return null;
        int y=Math.max(0,Math.round((startY+endY)/2f));
        if(y>=height-1)return null;
        return new PetHomeMap.Box(PetHomeMap.WIDGET,left,y,right,Math.min(height,y+thickness));
    }

    static boolean duplicate(List<PetHomeMap.Box> existing,PetHomeMap.Box edge,int tolerance){
        for(PetHomeMap.Box box:existing){
            if(Math.abs(box.t-edge.t)<=tolerance&&Math.abs(box.l-edge.l)<=tolerance&&
                    Math.abs(box.r-edge.r)<=tolerance)return true;
        }
        return false;
    }

    // Keep insertion order for undo. PetHomeMap.encode normally sorts a whole scene.
    static String encode(List<PetHomeMap.Box> edges,int width,int height){
        StringBuilder out=new StringBuilder();
        for(PetHomeMap.Box edge:edges)
            out.append(PetHomeMap.encode(java.util.Collections.singletonList(edge),width,height));
        return out.toString();
    }
}
