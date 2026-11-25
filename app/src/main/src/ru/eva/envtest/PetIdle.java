package ru.eva.envtest;

import java.util.Random;

final class PetIdle {
    enum Activity { WALK, BOOK, TEA, WINK, YAWN, STRETCH, JUMP, CLIMB, SURFACE, EXIT }

    private final Random random;
    private final Activity[] cycle=Activity.values();
    private int cursor=cycle.length;
    private Activity last;

    PetIdle(Random random) {
        this.random=random;
    }

    Activity next() {
        if(cursor==cycle.length){
            for(int i=cycle.length-1;i>0;i--)swap(i,random.nextInt(i+1));
            if(cycle[0]==last)swap(0,1+random.nextInt(cycle.length-1));
            cursor=0;
        }
        last=cycle[cursor++];
        return last;
    }

    private void swap(int a,int b){
        Activity item=cycle[a];
        cycle[a]=cycle[b];
        cycle[b]=item;
    }
}
