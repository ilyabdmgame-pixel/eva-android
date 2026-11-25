package ru.eva.envtest;

import java.util.List;

final class PetBall {
    final float radius,gravity,width,height;
    float x,y,vx,vy,spin;
    int bounces,contacts;
    PetMood.Cue lastBounce=PetMood.Cue.NONE;
    private final float density;

    PetBall(float x,float y,float vx,float vy,float density,int width,int height){
        this.density=density;
        radius=7.5f*density;
        gravity=695*density;
        this.width=width;this.height=height;
        this.x=PetMotion.clamp(x,radius,width-radius);
        this.y=PetMotion.clamp(y,radius,height-radius);
        this.vx=vx;this.vy=vy;
    }

    void step(float elapsed,List<PetHomeMap.Box> boxes){
        float remaining=PetMotion.clamp(elapsed,0,.10f);
        while(remaining>0){
            float dt=Math.min(remaining,1f/144);
            remaining-=dt;
            float oldX=x,oldY=y;
            vy=Math.min(vy+gravity*dt,density*960);
            x+=vx*dt;
            y+=vy*dt;
            for(PetHomeMap.Box box:boxes){
                if(x+radius<=box.l||x-radius>=box.r||y+radius<=box.t||y-radius>=box.b)continue;
                int previousBounces=bounces;
                if(vy>0&&oldY+radius<=box.t){
                    hitTop(box.t);
                }else if(vy<0&&oldY-radius>=box.b){
                    y=box.b+radius;
                    vy=-vy*.63f;
                    bounces++;
                }else if(vx>0&&oldX+radius<=box.l){
                    hitSide(box.l-radius);
                }else if(vx<0&&oldX-radius>=box.r){
                    hitSide(box.r+radius);
                }else continue;
                if(bounces!=previousBounces){
                    contacts++;
                    lastBounce=box.kind==PetHomeMap.ICON||box.kind==PetHomeMap.FOLDER?
                        PetMood.Cue.ICON:PetMood.Cue.SURFACE;
                }
            }
            int beforeBounds=bounces;
            if((x<radius&&vx<0)||(x>width-radius&&vx>0)){
                hitSide(PetMotion.clamp(x,radius,width-radius));
            }
            if(y>=height-radius)hitTop(height);
            else if(y<radius&&vy<0){
                y=radius;
                vy=-vy*.57f;
                bounces++;
            }
            if(bounces!=beforeBounds)lastBounce=PetMood.Cue.BOUNCE;
            spin=(spin+(float)Math.toDegrees(vx*dt/radius))%360;
        }
    }

    void tap(float horizontal,float vertical){
        vx=horizontal;
        vy=vertical;
    }

    private void hitSide(float edge){
        x=edge;
        vx=-vx*.74f;
        bounces++;
    }

    private void hitTop(float top){
        y=top-radius;
        if(vy>44*density){
            vy=-vy*.64f;
            vx*=.84f;
            bounces++;
        }else{
            vy=0;
            vx*=.968f;
        }
    }
}
