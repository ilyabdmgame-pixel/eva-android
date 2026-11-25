package ru.eva.envtest;

import java.util.ArrayList;
import java.util.Arrays;
import java.util.List;

public final class PetHomeMapTest {
    private static void check(boolean ok,String message){if(!ok)throw new AssertionError(message);}

    public static void main(String[] args){
        PetHomeMap.Box compact=PetHomeMap.launcherTile(44,866,322,1190,3.25f,true,false);
        check(compact!=null&&compact.kind==PetHomeMap.FOLDER&&compact.r-compact.l==182,
            "A compact HONOR folder should be available without its decorative children");
        PetHomeMap.Box wide=PetHomeMap.launcherTile(600,1190,1156,1838,3.25f,true,false);
        check(wide!=null&&wide.kind==PetHomeMap.FOLDER&&wide.r-wide.l>450,
            "A wide HONOR folder should retain its area");
        PetHomeMap.Box goal=new PetHomeMap.Box(PetHomeMap.FOLDER,730,650,870,790);
        PetHomeMap.Box overhang=new PetHomeMap.Box(PetHomeMap.WIDGET,350,540,510,720);
        List<PetHomeMap.Box> layout=Arrays.asList(goal,overhang);
        String saved=PetHomeMap.encode(layout,1000,900);
        List<PetHomeMap.Box> restored=PetHomeMap.decode(saved,1000,900);
        check(restored.size()==2&&restored.stream().anyMatch(b->b.same(goal,0)),"Home boundaries must round trip");
        check(PetHomeMap.decode("3,0,0,10001,10000;",1000,900).isEmpty(),"Reject invalid persisted boundaries");
        check(PetHomeMap.sameLayout(layout,Arrays.asList(overhang,goal),0),"Reordering should not invalidate a route");
        PetHomeMap.Box movedObstacle=new PetHomeMap.Box(PetHomeMap.WIDGET,380,540,540,720);
        check(!PetHomeMap.sameLayout(layout,Arrays.asList(goal,movedObstacle),3),
            "An obstacle change must invalidate a route even with the same target");

        PetHomeMap.Route route=PetHomeMap.plan(restored,40,200,300,800,600,0);
        check(route!=null&&route.support.same(goal,0),"Route should choose the folder");
        check(route.steps.get(0).mode==PetHomeMap.WALK
            &&route.steps.stream().anyMatch(s->s.mode==PetHomeMap.CRAWL),"Route should stand outside the crawl segment");
        PetHomeMap.Box low=new PetHomeMap.Box(PetHomeMap.ICON,453,868,496,896);
        PetHomeMap.Route jumping=PetHomeMap.plan(Arrays.asList(goal,low),40,200,300,800,600,1);
        check(jumping!=null&&jumping.steps.stream().anyMatch(s->s.mode==PetHomeMap.JUMP&&s.rise>=30),
            "A low obstacle should produce a jump with a valid rise");
        check(route.steps.stream().anyMatch(s->s.mode==PetHomeMap.PLACE),"Set ladder before climbing");
        check(route.steps.stream().anyMatch(s->s.mode==PetHomeMap.LADDER),"Ladder should lead up to high folder");
        PetHomeMap.Box shortLedge=new PetHomeMap.Box(PetHomeMap.FOLDER,730,718,870,816);
        PetHomeMap.Route shortPull=PetHomeMap.plan(Arrays.asList(shortLedge),40,200,300,800,600,0);
        check(shortPull!=null&&shortPull.railX<0&&shortPull.steps.stream().anyMatch(s->s.mode==PetHomeMap.MANTLE),
            "A ledge within reach should use the short pull-up");
        PetHomeMap.Step rail=route.steps.stream().filter(s->s.mode==PetHomeMap.LADDER).findFirst().get();
        check(rail.y<600&&rail.x==PetClimb.rootForHand(route.railX,200,2,route.left),
            "Long climbs must transfer the inner hand onto the ledge");
        PetHomeMap.Step last=route.steps.get(route.steps.size()-1);
        check(last.mode==PetHomeMap.MANTLE&&last.y+Math.round(300*PetPlacement.SEAT_CONTACT)==goal.t,
            "Hands and final seat should use the real folder top");

        List<PetHomeMap.Box> honor=new ArrayList<>();
        honor.add(new PetHomeMap.Box(PetHomeMap.WIDGET,85,132,1115,616));
        for(int x:new int[]{93,371,649})honor.add(new PetHomeMap.Box(PetHomeMap.FOLDER,x,760,x+180,940));
        honor.add(new PetHomeMap.Box(PetHomeMap.FOLDER,93,1084,273,1264));
        honor.add(new PetHomeMap.Box(PetHomeMap.FOLDER,642,1094,1114,1578));
        honor.add(new PetHomeMap.Box(PetHomeMap.FOLDER,93,1408,273,1588));
        honor.add(new PetHomeMap.Box(PetHomeMap.ICON,371,1408,551,1588));
        honor.add(new PetHomeMap.Box(PetHomeMap.FOLDER,86,1742,558,1902));
        honor.add(new PetHomeMap.Box(PetHomeMap.ICON,649,1732,829,1912));
        honor.add(new PetHomeMap.Box(PetHomeMap.FOLDER,927,1732,1107,1912));
        honor.add(new PetHomeMap.Box(PetHomeMap.DOCK,52,2188,1148,2445));
        for(int start:new int[]{0,894}){
            boolean hasIcon=false;
            for(int i=0;i<8;i++){
                PetHomeMap.Route actual=PetHomeMap.plan(honor,start,306,410,894,2035,i);
                if(actual!=null&&actual.support.kind!=PetHomeMap.DOCK)hasIcon=true;
            }
            check(hasIcon,"HONOR layout must reach at least one real workspace object from either side");
        }
        PetHomeMap.Box lower=new PetHomeMap.Box(PetHomeMap.FOLDER,220,670,650,760);
        PetHomeMap.Box upper=new PetHomeMap.Box(PetHomeMap.ICON,367,545,495,655);
        List<PetHomeMap.Box> platforms=Arrays.asList(lower,upper);
        check(PetHomeMap.landing(platforms,300,210,200,300,600,3,null)==upper,
            "A dragged avatar must stand on the first support below the soles");
        check(PetHomeMap.landing(platforms,305,280,200,300,600,3,null)==lower,
            "A platform already above the feet must be ignored");
        check(PetHomeMap.landing(platforms,0,100,200,300,600,3,null)==null,
            "An empty column must fall to the floor");
        check(PetHomeMap.landing(platforms,305,280,200,300,600,3,lower)==null,
            "A rope must not land on the platform it leaves");
        PetHomeMap.Box lip=new PetHomeMap.Box(PetHomeMap.FOLDER,360,500,500,650);
        PetHomeMap.Box close=new PetHomeMap.Box(PetHomeMap.ICON,495,714,610,790);
        PetHomeMap.Descent stepDown=PetHomeMap.descent(Arrays.asList(lip,close),lip,380,292,200,300,800,800,true,8);
        check(stepDown!=null&&stepDown.support==close&&!stepDown.usesRope()&&
            stepDown.track.startX==380&&stepDown.track.endY==PetHomeMap.standY(close,300),
            "A nearby step must keep its hand on the lip until the feet reach its neighbor");
        PetHomeMap.Box smallGap=new PetHomeMap.Box(PetHomeMap.ICON,495,757,610,820);
        PetHomeMap.Descent ropeDown=PetHomeMap.descent(Arrays.asList(lip,smallGap),lip,380,292,200,300,800,800,true,8);
        check(ropeDown!=null&&ropeDown.support==smallGap&&ropeDown.usesRope()&&
            ropeDown.track.endY==lip.t-Math.round(300*110f/540)&&ropeDown.track.last==PetRopeMotion.HANDOFF&&ropeDown.bottom==PetHomeMap.standY(smallGap,300),
            "Even a short gap after the last reach must keep a grip instead of free fall");
        PetHomeMap.Box missesShoe=new PetHomeMap.Box(PetHomeMap.ICON,531,757,602,820);
        check(PetHomeMap.descent(Arrays.asList(lip,missesShoe),lip,380,292,200,300,800,800,true,8)==null,
            "Reject a landing when the center is over a tile but the first planted shoe misses it");
        PetHomeMap.Box ropeBlock=new PetHomeMap.Box(PetHomeMap.ICON,491,620,508,685);
        check(PetHomeMap.descent(Arrays.asList(lip,smallGap,ropeBlock),lip,380,292,200,300,800,800,true,8)==null,
            "A blocked rope must leave the avatar on its source");
        PetHomeMap.Box beside=new PetHomeMap.Box(PetHomeMap.ICON,563,740,650,840);
        check(PetHomeMap.hasNearbyLowerSupport(Arrays.asList(lip,beside),lip,200,300),
            "An adjacent support outside the hand line should not lead to a route to the floor");
        PetHomeMap.Box high=new PetHomeMap.Box(PetHomeMap.FOLDER,415,390,595,560);
        PetHomeMap.Route climb=PetHomeMap.climbHigher(Arrays.asList(lower,high),lower,260,
            PetHomeMap.standY(lower,300),200,300,800,null);
        check(climb!=null&&climb.steps.stream().anyMatch(s->s.mode==PetHomeMap.LADDER),
            "A reachable higher floor must accept a ladder from a stable lower one");
        PetHomeMap.Box start=new PetHomeMap.Box(PetHomeMap.FOLDER,80,670,340,736);
        PetHomeMap.Box raised=new PetHomeMap.Box(PetHomeMap.FOLDER,410,590,570,655);
        PetHomeMap.Jump up=PetHomeMap.jumpHigher(Arrays.asList(start,raised),start,140,
            PetHomeMap.standY(start,300),200,300,800,3f,null);
        check(up!=null&&up.support==raised&&up.y==PetHomeMap.standY(raised,300),
            "An unobstructed jump should land with both feet on the higher platform");
        PetHomeMap.Box wall=new PetHomeMap.Box(PetHomeMap.FOLDER,320,510,390,680);
        check(PetHomeMap.jumpHigher(Arrays.asList(start,raised,wall),start,140,
            PetHomeMap.standY(start,300),200,300,800,3f,null)==null,
            "A side obstacle must prevent a jump through its bounding rectangle");

        PetHomeMap.Box dock=new PetHomeMap.Box(PetHomeMap.DOCK,52,2188,1148,2445);
        check(PetHomeMap.dockAt(Arrays.asList(dock),894,306,410,2035)==dock&&
            PetHomeMap.standY(dock,410)==1786,"The dock top, rather than its bottom, must be walkable");
        check(PetHomeMap.climbHigher(Arrays.asList(lower,high),lower,260,PetHomeMap.standY(lower,300),
            200,300,800,high)==null,"Avoid retracing a recently left route from the dock");

        PetHomeMap.Box rough=new PetHomeMap.Box(PetHomeMap.ICON,80,105,200,220);
        PetHomeMap.Box refined=PetHomeVision.refine(Arrays.asList(rough),(x,y)->
            x>=84&&x<196&&y>=101&&y<216?0xffbc805d:0xff231f1a,0,0,300,300,8).get(0);
        check(Math.abs(refined.l-84)<=1&&Math.abs(refined.t-101)<=1&&Math.abs(refined.r-196)<=1&&
            Math.abs(refined.b-216)<=1,"A screenshot must refine the rectangle around the physical icon");
        check(PetHomeVision.refine(Arrays.asList(rough),(x,y)->0xff000000,0,0,300,300,8).get(0).same(rough,0),
            "Uncertain image contrast should keep the known launcher coordinates");
        System.out.println("Home map: persistence, HONOR workspace, crawl, ladder and contact checked");
    }
}
