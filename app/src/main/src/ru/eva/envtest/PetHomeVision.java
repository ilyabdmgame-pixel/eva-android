package ru.eva.envtest;

import java.util.ArrayList;
import java.util.List;

final class PetHomeVision {
    interface Pixels { int color(int x,int y); }

    private PetHomeVision() {}

    static List<PetHomeMap.Box> refine(List<PetHomeMap.Box> boxes,Pixels pixels,
            int left,int top,int width,int height,int precision){
        List<PetHomeMap.Box> result=new ArrayList<>(boxes.size());
        for(PetHomeMap.Box b:boxes){
            int l=b.l-left,r=b.r-left,t=b.t-top,bottom=b.b-top;
            int radius=Math.min(precision,Math.min(r-l,bottom-t)/9);
            if(radius<2||l<0||r>width||t<0||bottom>height){result.add(b);continue;}
            int l2=edge(pixels,l,t,bottom,width,radius,false);
            int r2=edge(pixels,r,t,bottom,width,radius,false);
            int t2=edge(pixels,t,l,r,height,radius,true);
            int b2=edge(pixels,bottom,l,r,height,radius,true);
            result.add(new PetHomeMap.Box(b.kind,left+l2,top+t2,left+r2,top+b2));
        }
        return result;
    }

    private static int edge(Pixels pixels,int expected,int start,int end,int limit,int radius,boolean horizontal){
        int inset=(end-start)/4;
        int from=start+inset, until=end-inset;
        if(until<=from)return expected;
        int best=expected;
        float bestScore=0, background=0;
        int scans=0;
        for(int axis=Math.max(2,expected-radius);axis<Math.min(limit-2,expected+radius+1);axis++){
            float sum=0;
            int strong=0;
            for(int i=0;i<15;i++){
                int ptr=from+(until-from)*i/15;
                int a=horizontal?pixels.color(ptr,axis-2):pixels.color(axis-2,ptr);
                int b=horizontal?pixels.color(ptr,axis+1):pixels.color(axis+1,ptr);
                int d=contrast(a,b);
                sum+=Math.min(d,35);
                if(d>=9)strong++;
            }
            float score=sum/15;
            background+=score;
            scans++;
            if(strong>=8&&score>.18f*Math.abs(axis-expected)+bestScore){
                bestScore=score-.18f*Math.abs(axis-expected);
                best=axis;
            }
        }
        return scans>0&&bestScore>=Math.max(7,background/scans*1.5f)?best:expected;
    }

    private static int contrast(int a,int b){
        int red=Math.abs(((a>>16)&255)-((b>>16)&255));
        int green=Math.abs(((a>>8)&255)-((b>>8)&255));
        int blue=Math.abs((a&255)-(b&255));
        return (red+green+blue)/3;
    }
}
