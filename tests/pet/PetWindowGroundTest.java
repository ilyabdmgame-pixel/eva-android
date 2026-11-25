package ru.eva.envtest;

import java.util.ArrayList;
import java.util.Arrays;
import java.util.Collections;
import java.util.List;

public final class PetWindowGroundTest {
    private static void check(boolean pass,String msg){if(!pass)throw new AssertionError(msg);}

    public static void main(String[] args){
        int origin=123,w=306,h=410,floor=2035;
        List<PetWindows.Edge> keyboard=Collections.singletonList(
            new PetWindows.Edge(8,PetWindows.IME,0,1564,1200,2568));
        List<PetHomeMap.Box> terrain=PetWindowGround.local(keyboard,0,origin);
        PetHomeMap.Box ime=terrain.get(0);
        check(ime.window()&&ime.kind==PetHomeMap.KEYBOARD&&ime.t==1441,"Physical-to-overlay translation");
        check(PetWindowGround.covering(terrain,800,floor,w,h)==ime,"An opening IME lifts a pet standing behind it");
        int stand=PetHomeMap.standY(ime,h);
        check(origin+stand+Math.round(h*PetHomeMap.SOLE_CONTACT)==1564,"Foot on actual keyboard pixels");
        check(PetHomeMap.landing(terrain,410,stand-190,w,h,floor,0,null)==ime,"Drop from above keyboard");
        check(PetWindowGround.covering(terrain,410,stand-190,w,h)==null,"Airborne pet must finish falling");
        check(PetHomeMap.encode(terrain,1200,2445).isEmpty(),"Live app geometry can't enter saved launcher map");

        List<PetHomeMap.Box> dialog=PetWindowGround.local(Collections.singletonList(
            new PetWindows.Edge(15,PetWindows.APP,96,1056,1104,1635)),0,origin);
        PetHomeMap.Box old=dialog.get(0);
        check(PetWindowGround.covering(dialog,450,floor,w,h)==null,"A suspended dialog doesn't lift the floor");
        check(PetHomeMap.landing(dialog,450,100,w,h,floor,0,null)==old,"Drop onto the top of a dialog");
        List<PetHomeMap.Box> moved=PetWindowGround.local(Collections.singletonList(
            new PetWindows.Edge(15,PetWindows.APP,126,874,1134,1453)),0,origin);
        PetHomeMap.Box fresh=PetWindowGround.track(dialog,moved,old,450,w);
        check(fresh!=null&&PetWindowGround.carryX(old,fresh,450,w,894)==480&&
            PetHomeMap.standY(fresh,h)-PetHomeMap.standY(old,h)==-182,"Follow a moving window");
        check(PetWindowGround.track(dialog,terrain,old,450,w)==null,"Discard contact when window identity changes");
        check(PetWindowGround.track(dialog,Collections.emptyList(),old,450,w)==null,"Discard closed windows");
        List<PetHomeMap.Box> stack=new ArrayList<>(dialog);stack.add(ime);
        check(PetHomeMap.landing(stack,450,stand-600,w,h,floor,0,null)==old,"First boundary below the falling pet wins");
        for(int direction:new int[]{0,1}){
            int start=direction==0?0:894;
            int end=PetWindowGround.walkGoal(ime,start,w,894);
            check(Math.abs(start-end)>400&&PetWindowGround.fits(ime,end,w),"Walking must end on the same ledge");
        }
        List<PetWindows.Edge> partial=Arrays.asList(new PetWindows.Edge(17,PetWindows.IME,135,916,445,1900),
            new PetWindows.Edge(17,PetWindows.IME,755,916,1065,1900));
        List<PetHomeMap.Box> split=PetWindowGround.local(partial,0,origin);
        check(PetHomeMap.landing(split,445,80,w,h,floor,0,null)==null,"Avatar falls freely through split IME gap");
        check(PetWindowGround.covering(split,445,830,w,h)==null,"A floating keyboard doesn't span the whole screen");
        List<PetHomeMap.Box> right=Collections.singletonList(split.get(1));
        check(PetWindowGround.track(split,right,split.get(0),140,w)==null,"Disappearing left half must release the pet");
        List<PetHomeMap.Box> single=Collections.singletonList(split.get(0));
        check(PetWindowGround.track(single,right,split.get(0),140,w)==split.get(1),
            "A single floating window can carry the pet farther than its own width");
        List<PetWindows.Edge> wideInput=Collections.singletonList(new PetWindows.Edge(8,PetWindows.IME,123,484,2640,1128));
        PetHomeMap.Box wide=PetWindowGround.local(wideInput,123,123).get(0);
        int wideHeight=335,wideY=PetHomeMap.standY(wide,wideHeight);
        check(wide.l==0&&wide.t==361&&wideY>=0&&
            123+wideY+Math.round(wideHeight*PetHomeMap.SOLE_CONTACT)==484,"Landscape cutout and keyboard boundary");
        check(PetWindowGround.local(keyboard,0,origin).get(0).same(ime,0),"Return to portrait restores original contact");
        System.out.println("PetWindowGround: real HONOR IME/dialog coordinates, carry, close, stacked windows, walk and split geometry passed");
    }
}
