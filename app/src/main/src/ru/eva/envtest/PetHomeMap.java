package ru.eva.envtest;

import java.util.ArrayList;
import java.util.Comparator;
import java.util.List;

final class PetHomeMap {
    static final int ICON=0, FOLDER=1, WIDGET=2, DOCK=3, APP_WINDOW=4, KEYBOARD=5;
    static final int WALK=0, CRAWL=1, JUMP=2, PLACE=3, LADDER=4, MANTLE=5;
    static final float SOLE_CONTACT=530f/540f;
    private static final int NORMAL=10000;

    static final class Box {
        final int kind,l,t,r,b,windowId;
        Box(int kind,int l,int t,int r,int b){this(kind,l,t,r,b,-1);}
        Box(int kind,int l,int t,int r,int b,int windowId){
            this.kind=kind;this.l=l;this.t=t;this.r=r;this.b=b;this.windowId=windowId;
        }
        boolean window(){return kind==APP_WINDOW||kind==KEYBOARD;}
        boolean valid(){return kind>=ICON&&kind<=DOCK&&l>=0&&t>=0&&r>l&&b>t;}
        boolean crosses(int left,int top,int right,int bottom) {
            return l<right&&r>left&&t<bottom&&b>top;
        }
        boolean same(Box other,int tolerance){
            return kind==other.kind&&windowId==other.windowId&&Math.abs(l-other.l)<=tolerance&&Math.abs(t-other.t)<=tolerance&&
                Math.abs(r-other.r)<=tolerance&&Math.abs(b-other.b)<=tolerance;
        }
    }
    static final class Step {
        final int mode,x,y,rise;
        Step(int mode,int x,int y){this(mode,x,y,0);}
        Step(int mode,int x,int y,int rise){this.mode=mode;this.x=x;this.y=y;this.rise=rise;}
    }
    static final class Jump {
        final Box support;
        final int x,y,flight;
        Jump(Box support,int x,int y,int flight){this.support=support;this.x=x;this.y=y;this.flight=flight;}
    }
    static final class Descent {
        final Box support;
        final PetClimb.Track track;
        final int bottom;
        Descent(Box support,PetClimb.Track track,int bottom){
            this.support=support;this.track=track;this.bottom=bottom;
        }
        boolean usesRope(){return track.endY<bottom;}
    }
    static final class Route {
        final Box support;
        final boolean left;
        final int railX;
        final List<Step> steps;
        final PetLadderMotion ascent;
        Route(Box support,boolean left,PetLadderMotion ascent,List<Step> steps){
            this.support=support;this.left=left;this.ascent=ascent;this.railX=ascent==null?-1:ascent.edge;this.steps=steps;
        }
    }

    private static final class Crossing {
        final int start,mode;
        int end;
        Crossing(int start,int end,int mode){this.start=start;this.end=end;this.mode=mode;}
    }

    private PetHomeMap(){}

    static Box launcherTile(int left,int top,int right,int bottom,float density,boolean container,boolean leaf){
        int w=right-left,h=bottom-top,icon=Math.round(density*56);
        if(left<0||top<0||w<icon||h<icon)return null;
        if(w<=density*115&&h<=density*130&&(leaf||container)){
            int x=(left+right-icon)/2,y=top+Math.round(density*5);
            return new Box(container?FOLDER:ICON,x,y,x+icon,Math.min(bottom,y+icon));
        }
        if(container&&w>=density*135&&w<=density*195&&h<=density*210){
            int edge=Math.round(density*13),head=Math.round(density*8);
            int y=top+head;
            return new Box(FOLDER,left+edge,y,right-edge,bottom-Math.round(density*42));
        }
        return null;
    }

    static String encode(List<Box> boxes,int width,int height){
        if(width<=0||height<=0)return "";
        List<Box> sorted=new ArrayList<>(boxes);
        sorted.sort(Comparator.comparingInt((Box b)->b.t).thenComparingInt(b->b.l).thenComparingInt(b->b.kind));
        StringBuilder out=new StringBuilder();
        for(Box b:sorted)if(b.valid()&&b.r<=width&&b.b<=height)out.append(b.kind).append(',')
            .append(norm(b.l,width)).append(',').append(norm(b.t,height)).append(',')
            .append(norm(b.r,width)).append(',').append(norm(b.b,height)).append(';');
        return out.toString();
    }

    static List<Box> decode(String value,int width,int height){
        List<Box> result=new ArrayList<>();
        if(value==null||value.isEmpty()||value.length()>3200||width<=0||height<=0)return result;
        try{
            for(String row:value.split(";")){
                if(result.size()==48)break;
                String[] cells=row.split(",");
                if(cells.length!=5)return new ArrayList<>();
                int[] n=new int[5];
                for(int i=0;i<n.length;i++)n[i]=Integer.parseInt(cells[i]);
                if(n[1]<0||n[2]<0||n[3]>NORMAL||n[4]>NORMAL)return new ArrayList<>();
                Box box=new Box(n[0],denorm(n[1],width),denorm(n[2],height),denorm(n[3],width),denorm(n[4],height));
                if(box.valid())result.add(box);
            }
        }catch(NumberFormatException error){return new ArrayList<>();}
        return result;
    }

    static boolean sameLayout(List<Box> previous,List<Box> fresh,int tolerance){
        if(previous.size()!=fresh.size())return false;
        List<Box> remaining=new ArrayList<>(fresh);
        for(Box box:previous){
            int match=-1;
            for(int i=0;i<remaining.size();i++)if(box.same(remaining.get(i),tolerance)){match=i;break;}
            if(match<0)return false;
            remaining.remove(match);
        }
        return true;
    }

    private static int norm(int coordinate,int extent){return Math.round(coordinate*NORMAL/(float)extent);}
    private static int denorm(int coordinate,int extent){return Math.round(coordinate*extent/(float)NORMAL);}

    static int standY(Box box,int h){return box.t-Math.round(h*SOLE_CONTACT);}

    static Box dockAt(List<Box> boxes,int x,int w,int h,int floor){
        int center=x+w/2,footing=Math.round(w*.08f);
        for(Box box:boxes)if(box.kind==DOCK&&box.l<=center-footing&&box.r>=center+footing&&
            standY(box,h)>=0&&standY(box,h)<floor)return box;
        return null;
    }

    static Box landing(List<Box> boxes,int x,int y,int w,int h,int floor,int tolerance,Box departing){
        Box hit=null;
        int center=x+w/2, footing=Math.round(w*.08f);
        for(Box box:boxes){
            int top=standY(box,h);
            if(departing!=null&&departing.same(box,tolerance)||top<0||top<y-tolerance||top>=floor||
                    center-footing<box.l||center+footing>box.r)continue;
            if(hit==null||box.t<hit.t)hit=box;
        }
        return hit;
    }

    static Descent descent(List<Box> boxes,Box from,int x,int y,int w,int h,int maxX,int floor,
            boolean left,int margin){
        int edge=left?from.r:from.l;
        int catchY=PetClimb.climbToY(from.t,h);
        int ropeX=edge-PetMotion.ropeHandX(w,left);
        Descent best=null;
        for(Box to:boxes){
            int bottom=standY(to,h);
            if(from.same(to,margin)||bottom<=y+margin||bottom>=floor)continue;
            Descent route=descentTo(boxes,from,to,x,y,w,h,maxX,floor,left,margin,edge,ropeX,catchY,bottom);
            if(route!=null&&(best==null||route.bottom<best.bottom))best=route;
        }
        if(best!=null)return best;
        return descentTo(boxes,from,null,x,y,w,h,maxX,floor,left,margin,edge,ropeX,catchY,floor);
    }

    private static Descent descentTo(List<Box> boxes,Box from,Box to,int x,int y,int w,int h,int maxX,
            int floor,boolean left,int margin,int edge,int ropeX,int catchY,int bottom){
        boolean rope=bottom>catchY;
        int hangY=rope?from.t-Math.round(h*PetMotion.mantleContactAt(PetRopeMotion.HANDOFF)/540f):bottom;
        if(hangY<=y+margin)return null;
        float last=rope?PetRopeMotion.HANDOFF:PetMotion.mantleStart((from.t-hangY)*540f/h);
        int hangX=PetClimb.rootForHand(edge,w,last,left);
        int landingX=rope?ropeX:hangX;
        if(hangX<0||hangX>maxX||landingX<0||landingX>maxX||Math.abs(hangX-x)>w/2||
                landing(boxes,landingX,y+margin,w,h,floor,0,from)!=to)return null;
        if(rope&&to!=null){
            float footX=landingX+w*(left?402-PetRopeMotion.FOOT_X:PetRopeMotion.FOOT_X)/402f;
            if(footX<to.l||footX>=to.r)return null;
        }
        if(rope&&!clearRope(boxes,from,to,edge,bottom+Math.round(h*SOLE_CONTACT),margin))return null;
        PetClimb.Track track=new PetClimb.Track(x,y,hangX,hangY,edge,w,left,11,last);
        boolean visible=rope?PetRopeMotion.fitsEdge(track,maxX,floor):fits(track,maxX,floor);
        return visible?new Descent(to,track,bottom):null;
    }

    static boolean hasNearbyLowerSupport(List<Box> boxes,Box from,int width,int height){
        for(Box to:boxes)if(to.kind!=DOCK&&to.t>from.t&&to.t<=from.t+height&&
                to.r>from.l-width/3&&to.l<from.r+width/3)return true;
        return false;
    }

    static Jump jumpHigher(List<Box> boxes,Box from,int x,int y,int w,int h,int maxX,float density,Box avoid){
        Jump best=null;
        int bestCost=Integer.MAX_VALUE;
        for(Box to:boxes){
            if(avoid!=null&&avoid.same(to,4))continue;
            int nextX=bound((to.l+to.r-w)/2,maxX),nextY=standY(to,h);
            int lift=y-nextY, distance=Math.abs(nextX-x);
            int center=nextX+w/2, footing=Math.round(w*.08f);
            if(nextY<0||lift<h/15||lift>h*3/5||distance>w*7/5||
                    center-footing<to.l||center+footing>to.r)continue;
            int flight=PetPhysics.jumpTimeForLanding(-lift,Math.round(h/9f),density);
            boolean clear=true;
            for(int i=1;i<24&&clear;i++){
                float t=i/24f;
                int bodyX=Math.round(x+(nextX-x)*t),bodyY=PetPhysics.jumpY(y,nextY,t,flight,density);
                for(Box b:boxes){
                    if(from.same(b,3)||b.kind==DOCK)continue;
                    if(b.crosses(bodyX+w/4,bodyY+h/6,bodyX+w*3/4,bodyY+Math.round(h*SOLE_CONTACT)-2)){
                        clear=false;
                        break;
                    }
                }
            }
            int cost=distance+lift;
            if(clear&&cost<bestCost){bestCost=cost;best=new Jump(to,nextX,nextY,flight);}
        }
        return best;
    }

    static Route climbHigher(List<Box> boxes,Box from,int x,int y,int w,int h,int maxX,Box avoid){
        List<Box> higher=new ArrayList<>(boxes);
        higher.sort(Comparator.comparingInt((Box b)->-b.t));
        for(Box to:higher){
            if(avoid!=null&&avoid.same(to,4))continue;
            if(to.t>=from.t-h/12||to.r-to.l<Math.round(w*.3f))continue;
            int seatY=to.t-Math.round(h*PetPlacement.SEAT_CONTACT);
            if(seatY<0||seatY>=y)continue;
            int seat=bound((to.l+to.r-w)/2,maxX);
            for(boolean right:new boolean[]{x>seat,x<=seat}){
                Route result=route(boxes,to,from,right,x,seat,seatY,w,h,maxX,y);
                if(result!=null)return result;
            }
        }
        return null;
    }

    static Route plan(List<Box> boxes,int x,int w,int h,int maxX,int floorY,int turn){
        if(boxes.isEmpty()||w<=0||h<=0||maxX<1||floorY<1)return null;
        List<Box> supports=new ArrayList<>(boxes);
        supports.sort(Comparator.comparingInt((Box b)->b.kind==DOCK?1:0).thenComparingInt(b->-b.t));
        int choices=Math.min(supports.size(),8);
        for(int offset=0;offset<supports.size();offset++){
            int i=offset<choices?Math.floorMod(turn+offset,choices):offset;
            Box support=supports.get(i);
            int targetY=support.t-Math.round(h*PetPlacement.SEAT_CONTACT);
            if(targetY<0||targetY>floorY||support.r-support.l<Math.round(w*.30f))continue;
            int seatX=bound((support.l+support.r-w)/2,maxX);
            for(int side=0;side<2;side++){
                boolean fromRight=side==0?x>seatX:x<=seatX;
                Route route=route(boxes,support,null,fromRight,x,seatX,targetY,w,h,maxX,floorY);
                if(route!=null)return route;
            }
        }
        return null;
    }

    private static Route route(List<Box> boxes,Box support,Box from,boolean fromRight,int x,
            int seat,int targetY,int w,int h,int maxX,int floor){
        int sole=floor+Math.round(h*SOLE_CONTACT);
        int standingTop=sole-Math.round(h*.86f), crawlingTop=sole-Math.round(h*.43f);
        int rail=fromRight?support.r:support.l;
        boolean ladder=PetClimb.needsLadder(support.t,floor,h);
        PetLadderMotion ascent=ladder?placeLadder(boxes,support,from,rail,sole,w,h,fromRight,maxX,floor):null;
        if(ladder&&ascent==null)return null;
        int gripY=ladder?ascent.endY:floor;
        if(gripY<0)return null;
        float first=PetMotion.mantleStart((support.t-gripY)*540f/h);
        int approach=ladder?ascent.startX:PetClimb.rootForHand(rail,w,first,fromRight);
        if(approach<0||approach>maxX)return null;
        int handoffX=ladder?ascent.endX:approach;
        if(handoffX<0||handoffX>maxX)return null;
        int center=approach+w/2,footing=Math.round(w*.08f);
        if(from!=null&&(center-footing<from.l||center+footing>from.r))return null;
        List<Step> steps=groundPath(boxes,support,x,approach,w,h,floor,sole,standingTop,crawlingTop);
        if(steps==null)return null;
        if(ladder){
            steps.add(new Step(PLACE,approach,floor));
            steps.add(new Step(LADDER,handoffX,gripY));
        }
        PetClimb.Track pull=new PetClimb.Track(handoffX,gripY,seat,targetY,rail,w,fromRight,first,11);
        if(!fits(pull,maxX,floor))return null;
        steps.add(new Step(MANTLE,seat,targetY));
        return new Route(support,fromRight,ascent,steps);
    }

    private static PetLadderMotion placeLadder(List<Box> boxes,Box support,Box from,int edge,int sole,
            int w,int h,boolean left,int maxX,int floor){
        int half=PetLadderMotion.halfSpan(w),side=left?1:-1;
        // Try the outside edge first, then lean it against the front of the target tile.
        for(int offset:new int[]{half,0,-half}){
            int axis=edge+side*offset;
            PetLadderMotion climb=new PetLadderMotion(edge,support.t,sole,w,h,left,axis);
            if(!climb.fitsViewport(maxX,floor))continue;
            if(from!=null&&(axis-w*.08f<from.l||axis+w*.08f>from.r))continue;
            boolean clear=true;
            for(Box b:boxes){
                if(b!=support&&b!=from&&b.kind!=DOCK&&b.crosses(axis-half,support.t,axis+half,sole)){
                    clear=false;break;
                }
            }
            if(clear)return climb;
        }
        return null;
    }

    static boolean fits(PetClimb.Track track,int maxX,int maxY){
        for(int i=0;i<=24;i++){
            PetMotion.Position p=track.position(i/24f);
            if(p.x<0||p.x>maxX||p.y<0||p.y>maxY)return false;
        }
        return true;
    }

    static boolean clearRope(List<Box> boxes,Box from,Box to,int edge,int floor,int margin){
        for(Box box:boxes){
            if(from.same(box,4)||(to!=null&&to.same(box,4)))continue;
            if(box.crosses(edge-margin,from.t+margin,edge+margin,floor))return false;
        }
        return true;
    }

    private static List<Step> groundPath(List<Box> boxes,Box support,int x,int approach,int w,int h,
            int floor,int sole,int standingTop,int crawlingTop){
        int direction=approach>=x?1:-1, distance=Math.abs(x-approach);
        int front=(w*3+3)/4, back=w/4;
        int left=Math.min(x,approach)+back,right=Math.max(x,approach)+front;
        List<Crossing> crossings=new ArrayList<>();
        for(Box box:boxes){
            if(box==support||box.kind==DOCK||!box.crosses(left,standingTop,right,sole))continue;
            int mode=box.b<=crawlingTop?CRAWL:box.t>=sole-h/6?JUMP:-1;
            if(mode<0)return null;
            int enter=direction>0?box.l-front-x:x-(box.r-back);
            int leave=direction>0?box.r-back-x:x-(box.l-front);
            int margin=mode==CRAWL?Math.max(1,w/18):Math.max(1,w/4);
            if(enter<margin||leave+margin>distance)return null;
            crossings.add(new Crossing(enter-margin,leave+margin,mode));
        }
        crossings.sort(Comparator.comparingInt(c->c.start));
        List<Crossing> sections=new ArrayList<>();
        for(Crossing crossing:crossings){
            Crossing previous=sections.isEmpty()?null:sections.get(sections.size()-1);
            if(previous!=null&&crossing.start<=previous.end){
                if(previous.mode!=CRAWL||crossing.mode!=CRAWL)return null;
                previous.end=Math.max(previous.end,crossing.end);
            }else sections.add(crossing);
        }
        List<Step> result=new ArrayList<>();
        int cursor=0;
        for(Crossing section:sections){
            if(section.start>cursor)result.add(new Step(WALK,x+direction*section.start,floor));
            int rise=section.mode==JUMP?clearJump(boxes,x+direction*section.start,
                x+direction*section.end,w,h,sole,standingTop,floor):0;
            if(rise<0)return null;
            result.add(new Step(section.mode,x+direction*section.end,floor,rise));
            cursor=section.end;
        }
        if(cursor<distance)result.add(new Step(WALK,approach,floor));
        return result;
    }

    private static int clearJump(List<Box> boxes,int start,int end,int w,int h,int sole,int head,int floor){
        if(Math.abs(end-start)>2*w)return -1;
        int riseLimit=Math.min(floor,h/3);
        for(int rise=Math.max(1,h/10);rise<=riseLimit;rise+=Math.max(1,h/60)){
            boolean clear=true;
            int intervals=Math.max(16,Math.abs(end-start)/4);
            for(int n=0;n<=intervals&&clear;n++){
                float t=n/(float)intervals;
                int left=Math.round(start+(end-start)*t)+w/4;
                int right=left+w/2;
                int lift=Math.round(4*rise*t*(1-t));
                // A small margin accounts for movement between the sampled positions.
                for(Box b:boxes)if(b.kind!=DOCK&&b.crosses(left-3,head-lift-3,right+3,sole-lift+3)){
                    clear=false;
                    break;
                }
            }
            if(clear)return rise;
        }
        return -1;
    }

    private static int bound(int x,int max){return Math.max(0,Math.min(max,x));}
}
