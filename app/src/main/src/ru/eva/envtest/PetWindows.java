package ru.eva.envtest;

import java.util.ArrayList;
import java.util.Collections;
import java.util.List;

/** Exposed horizontal edges of interactive windows, in physical screen coordinates. */
final class PetWindows {
    static final int IME=1, APP=2, BLOCKER=3;

    static final class Edge {
        final int id,kind,l,t,r,b;
        Edge(int id,int kind,int l,int t,int r,int b){
            this.id=id;this.kind=kind;this.l=l;this.t=t;this.r=r;this.b=b;
        }
        @Override public boolean equals(Object other){
            if(!(other instanceof Edge))return false;
            Edge e=(Edge)other;
            return id==e.id&&kind==e.kind&&l==e.l&&t==e.t&&r==e.r&&b==e.b;
        }
        @Override public int hashCode(){return ((((id*31+kind)*31+l)*31+t)*31+r)*31+b;}
    }

    private PetWindows(){}

    static final String[] PANEL_IDS={"design_bottom_sheet","bottom_navigation","bottom_navigation_view"};

    static boolean fullLandscapeIme(Edge window,int l,int t,int r,int b){
        return window.kind==IME&&r-l>b-t&&window.l<=l&&window.t<=t&&window.r>=r&&window.b>=b;
    }

    static Edge extractedKeyboard(Edge host,Edge extract,Edge input){
        if(extract==null||input==null||extract.id!=host.id||input.id!=host.id||
                extract.l!=host.l||input.l!=host.l||extract.r!=host.r||input.r!=host.r||
                extract.t!=host.t||extract.b!=input.t||input.b!=host.b||
                extract.t>=extract.b||input.t>=input.b)return null;
        return input;
    }

    static Edge panel(int windowId,String entry,String className,Edge host,int l,int t,int r,int b,float density){
        boolean sheet=PANEL_IDS[0].equals(entry);
        if(sheet){
            if(!"android.widget.FrameLayout".equals(className)&&!"android.view.ViewGroup".equals(className))return null;
        }else{
            if(!PANEL_IDS[1].equals(entry)&&!PANEL_IDS[2].equals(entry))return null;
            if(!"com.google.android.material.bottomnavigation.BottomNavigationView".equals(className)&&
                    !"android.support.design.widget.BottomNavigationView".equals(className))return null;
        }
        // A canonical container can cover the whole activity when expanded. Only
        // a visible inset top and a bottom attached to this window are physical edges.
        int slop=Math.max(1,Math.round(8*density));
        if(windowId<0||windowId>Integer.MAX_VALUE/2||l<host.l-slop||r>host.r+slop||
                t<=host.t+slop||b<host.b-slop||r-l<Math.max(72*density,(host.r-host.l)*.45f))return null;
        l=Math.max(l,host.l);r=Math.min(r,host.r);b=Math.min(b,host.b);
        if(b-t<24*density||!sheet&&b-t>130*density)return null;
        // Android window ids are nonnegative. Keep each panel role distinct across
        // rotation, motion, and replacement by another panel in the same activity.
        return new Edge(~(windowId*2+(sheet?0:1)),APP,l,t,r,b);
    }

    // Each inner list contains the disjoint rectangles of one Android Region. Layers
    // arrive front to back. Subtract covered parts before accepting a support.
    static List<Edge> exposed(List<List<Edge>> layers,int left,int top,int width,int height,int minWidth){
        if(width<=0||height<=0)return Collections.emptyList();
        int right=left+width,bottom=top+height;
        List<Edge> result=new ArrayList<>(),higher=new ArrayList<>();
        for(List<Edge> layer:layers){
            for(Edge part:layer){
                if(part.kind==BLOCKER||part.t<=top||part.t>=bottom||part.b<=part.t)continue;
                int l=Math.max(part.l,left),r=Math.min(part.r,right);
                if(r-l<minWidth)continue;
                List<Edge> run=new ArrayList<>();
                run.add(new Edge(part.id,part.kind,l,part.t,r,Math.min(bottom,part.b)));
                for(Edge cover:higher){
                    if(cover.t<=part.t&&cover.b>=part.t)subtract(run,cover.l,cover.r);
                }
                // RegionIterator also yields bands within a single rounded/floating
                // window. A band covered across its top by another band is not a ledge.
                for(Edge above:layer){
                    if(above.b==part.t)subtract(run,above.l,above.r);
                }
                for(Edge segment:run){
                    if(segment.r-segment.l<minWidth)continue;
                    // A rounded IME may begin with a one-pixel band. Follow the
                    // material underneath this span, including successive wider bands.
                    int base=segment.b;
                    for(Edge next:layer){
                        if(next.t==base&&next.l<=segment.l&&next.r>=segment.r)
                            base=Math.min(bottom,next.b);
                    }
                    result.add(base==segment.b?segment:new Edge(segment.id,segment.kind,
                            segment.l,segment.t,segment.r,base));
                }
            }
            higher.addAll(layer);
        }
        return Collections.unmodifiableList(result);
    }

    private static void subtract(List<Edge> pieces,int left,int right){
        for(int i=pieces.size()-1;i>=0;i--){
            Edge p=pieces.get(i);
            if(left>=p.r||right<=p.l)continue;
            pieces.remove(i);
            if(right<p.r)pieces.add(i,new Edge(p.id,p.kind,right,p.t,p.r,p.b));
            if(left>p.l)pieces.add(i,new Edge(p.id,p.kind,p.l,p.t,left,p.b));
        }
    }
}
