package ru.eva.envtest;

import java.util.ArrayList;
import java.util.List;

public class PetLearnedEdgesTest {
    public static void main(String[] args){
        if(PetLearnedEdges.page("Экран 2 из 12")!=2||PetLearnedEdges.page("Page 1 of 12")!=1||
                PetLearnedEdges.page(null)!=-1||PetLearnedEdges.page("Экран")!=-1)
            throw new AssertionError("Launcher workspace page");
        if(PetLearnedEdges.key(0,1).equals(PetLearnedEdges.key(0,2))||
                PetLearnedEdges.key(1,2).equals(PetLearnedEdges.key(0,2))||
                PetLearnedEdges.key(0,-1)!=null)throw new AssertionError("Page and rotation scoped");
        PetHomeMap.Box low=PetLearnedEdges.stroke(302,688,101,692,420,940,30,4);
        PetHomeMap.Box high=PetLearnedEdges.stroke(75,385,299,385,420,940,30,4);
        if(low.l!=101||low.r!=302||low.t!=690||low.b!=694||
            PetLearnedEdges.stroke(80,60,105,61,420,940,30,4)!=null||
            PetLearnedEdges.stroke(40,60,98,250,420,940,30,4)!=null)throw new AssertionError("Stroke validation");
        List<PetHomeMap.Box> list=new ArrayList<>();list.add(low);list.add(high);
        if(!PetLearnedEdges.duplicate(list,new PetHomeMap.Box(PetHomeMap.WIDGET,75,386,299,401),2))
            throw new AssertionError("Duplicated top edge");
        List<PetHomeMap.Box> restored=PetHomeMap.decode(PetLearnedEdges.encode(list,420,940),420,940);
        if(restored.size()!=2||!restored.get(1).same(high,1))throw new AssertionError("Undo order");
        if(PetHomeMap.landing(restored,101,400,80,130,810,0,null)!=restored.get(0))
            throw new AssertionError("Restored taught ledge supports drop");
        System.out.println("Manual supports: page/rotation, stroke, persistent undo order and landing checked");
    }
}
