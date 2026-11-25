package ru.eva.envtest;

import android.graphics.Bitmap;
import android.graphics.Rect;
import java.util.ArrayList;
import java.util.Collections;
import java.util.List;

/** Ephemeral artwork from a confirmed launcher window; no OCR, files or app text. */
final class PetLauncherCutout {
    final Rect bounds;
    final Bitmap art,background;
    final int[] letterEdges;
    PetLauncherCutout(Rect bounds,Bitmap art,Bitmap background,int[] edges){
        this.bounds=bounds;this.art=art;this.background=background;letterEdges=edges;
    }
    boolean label(){return letterEdges!=null;}

    static List<PetLauncherCutout> collect(Bitmap image,int ox,int oy,List<PetHomeMap.Box> boxes){
        List<PetLauncherCutout> out=new ArrayList<>();
        for(PetHomeMap.Box box:boxes){
            if(box.kind!=PetHomeMap.ICON&&box.kind!=PetHomeMap.FOLDER)continue;
            int w=box.r-box.l,h=box.b-box.t;
            if(w<20||w>360||h>w*1.20||h<w*.78)continue;
            Rect icon=new Rect(box.l-ox,box.t-oy,box.r-ox,box.b-oy);
            if(!fits(image,icon))continue;
            if(box.kind==PetHomeMap.ICON){
                Bitmap crop=Bitmap.createBitmap(image,icon.left,icon.top,w,h);
                add(out,icon,ox,oy,crop,backdrop(image,icon),null);
            }
            int margin=w/5;
            Rect label=new Rect(icon.left-margin,icon.bottom+1,icon.right+margin,icon.bottom+1+h*43/100);
            if(fits(image,label))letters(image,label,ox,oy,out);
            if(out.size()>=16)break;
        }
        return Collections.unmodifiableList(out);
    }
    private static boolean fits(Bitmap b,Rect r){
        return r.left>=1&&r.top>=1&&r.right<b.getWidth()-1&&r.bottom<b.getHeight()-1&&!r.isEmpty();
    }
    private static void add(List<PetLauncherCutout> list,Rect r,int ox,int oy,Bitmap art,Bitmap bg,int[] edges){
        Rect bounds=new Rect(r);bounds.offset(ox,oy);
        list.add(new PetLauncherCutout(bounds,art,bg,edges));
    }
    // Interpolate between wallpaper strips beside the target. This fills the
    // tiny temporary hole without reading or retaining a second screen image.
    private static Bitmap backdrop(Bitmap image,Rect area){
        int h=area.height(),w=8,colors[]=new int[w*h];
        for(int y=0;y<h;y++){
            int a=image.getPixel(area.left-1,area.top+y),b=image.getPixel(area.right,area.top+y);
            for(int x=0;x<w;x++){
                int k=w-1-x;
                int r=((a>>16&255)*k+(b>>16&255)*x)/(w-1);
                int g=((a>>8&255)*k+(b>>8&255)*x)/(w-1);
                int blue=((a&255)*k+(b&255)*x)/(w-1);
                colors[y*w+x]=0xff000000|r<<16|g<<8|blue;
            }
        }
        return Bitmap.createBitmap(colors,w,h,Bitmap.Config.ARGB_8888);
    }
    private static void letters(Bitmap src,Rect r,int ox,int oy,List<PetLauncherCutout> list){
        int w=r.width(),h=r.height();
        int[] pixels=new int[w*h];src.getPixels(pixels,0,w,r.left,r.top,w,h);
        int[] ink=new int[w];int low=h,high=-1;
        for(int i=0;i<pixels.length;i++){
            int c=pixels[i],min=Math.min(c&255,Math.min(c>>8&255,c>>16&255));
            int max=Math.max(c&255,Math.max(c>>8&255,c>>16&255));
            int alpha=max-min<42?Math.min(255,Math.max(0,min-170)*3):0;
            pixels[i]=alpha<<24|0xffffff;
            if(alpha>120){ink[i%w]++;low=Math.min(low,i/w);high=Math.max(high,i/w);}
        }
        if(ink[0]>1||ink[w-1]>1||high-low<7||high-low>h*.88)return;
        ArrayList<Integer> spans=new ArrayList<>();
        for(int x=0;x<w;){
            if(ink[x]<2){x++;continue;}
            int start=x++;while(x<w&&ink[x]>=2)x++;
            if(x-start>2){spans.add(start);spans.add(x);}
        }
        if(spans.size()<6||spans.size()>32)return;
        int[] edges=new int[spans.size()];for(int i=0;i<edges.length;i++)edges[i]=spans.get(i);
        add(list,r,ox,oy,Bitmap.createBitmap(pixels,w,h,Bitmap.Config.ARGB_8888),backdrop(src,r),edges);
    }
}
